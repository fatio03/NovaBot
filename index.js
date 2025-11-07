const fs = require("fs");
const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREGUNTAS = JSON.parse(fs.readFileSync("preguntas.json", "utf8"));
const PROGRESO_FILE = "progreso.json";
let progreso = fs.existsSync(PROGRESO_FILE)
  ? JSON.parse(fs.readFileSync(PROGRESO_FILE, "utf8"))
  : {};

function guardarProgreso() {
  fs.writeFileSync(PROGRESO_FILE, JSON.stringify(progreso, null, 2));
}

// Roles de módulos reales
const ROLES = {
  simbolos: "Módulo 1 - Símbolos",
  teoria_de_conjuntos: "Módulo 2 - Teoría de Conjuntos",
  tabla_de_verdad: "Módulo 3 - Tabla de Verdad",
  condicionales: "Módulo 4 - Condicionales",
  ciclos: "Módulo 5 - Ciclos",
  subprogramas: "Módulo 6 - Subprogramas",
  vectores: "Módulo 7 - Vectores"
};

// Enviar pregunta
function enviarPregunta(canal, id) {
  const { modulo, indice } = progreso[id];
  const pregunta = PREGUNTAS[modulo][indice];
  let opciones = "";
  pregunta.opciones.forEach((op, i) => {
    opciones += `${i + 1}. ${op}\n`;
  });
  canal.send(`**${pregunta.pregunta}**\n${opciones}\n✏️ Responde con el número de la opción correcta.`);
}

// Crear canal privado
async function crearCanalPrivado(guild, usuario) {
  const canal = await guild.channels.create({
    name: `examen-${usuario.username.toLowerCase()}`,
    type: 0,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: usuario.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
        ],
      },
    ],
  });
  return canal;
}

// Lógica principal
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  const id = msg.author.id;
  const contenido = msg.content.trim().toLowerCase();

  // ===============================
  // !examen
  // ===============================
  if (contenido.startsWith("!examen")) {
    if (!progreso[id]) {
      const primerModulo = Object.keys(PREGUNTAS)[0];
      progreso[id] = { modulo: primerModulo, indice: 0, puntos: 0, canalId: null };
      guardarProgreso();
    }

    const usuario = msg.author;
    let canal;

    // Crear canal privado
    if (progreso[id].canalId) {
      canal = msg.guild.channels.cache.get(progreso[id].canalId);
      if (!canal) progreso[id].canalId = null;
    }

    if (!progreso[id].canalId) {
      canal = await crearCanalPrivado(msg.guild, usuario);
      progreso[id].canalId = canal.id;
      guardarProgreso();
      canal.send(`👋 ¡Hola ${usuario.username}! Este es tu canal privado de examen del módulo **${progreso[id].modulo}**.`);
      enviarPregunta(canal, id);
    } else {
      canal.send(`🔄 Continuando tu examen del módulo **${progreso[id].modulo}**.`);
      enviarPregunta(canal, id);
    }
    return;
  }

  // ===============================
  // !reset
  // ===============================
  if (contenido.startsWith("!reset") && msg.member.permissions.has("Administrator")) {
    const usuarioMencionado = msg.mentions.users.first();
    if (!usuarioMencionado) return msg.reply("❌ Debes mencionar un usuario.");
    delete progreso[usuarioMencionado.id];
    guardarProgreso();
    return msg.reply(`♻️ Progreso de ${usuarioMencionado.username} reiniciado.`);
  }

  // ===============================
  // !puntaje
  // ===============================
  if (contenido.startsWith("!puntaje")) {
    const partes = contenido.split(" ");
    const usuarioMencionado = msg.mentions.users.first();
    const numeroModulo = parseInt(partes[2]);
    if (!usuarioMencionado || isNaN(numeroModulo)) {
      return msg.reply("Uso: !puntaje @usuario <número_modulo>");
    }
    const modulos = Object.keys(PREGUNTAS);
    const modulo = modulos[numeroModulo - 1];
    if (!modulo) return msg.reply("❌ Ese número de módulo no existe.");

    const data = progreso[usuarioMencionado.id];
    if (!data || data.modulo !== modulo) return msg.reply("No hay registro de puntaje en ese módulo.");

    msg.reply(`📊 Puntaje de ${usuarioMencionado.username} en **${modulo}**: ${data.puntos}/${PREGUNTAS[modulo].length}`);
  }

  // ===============================
  // !delete-exam
  // ===============================
  if (contenido.startsWith("!delete-exam") && msg.member.permissions.has("Administrator")) {
    if (msg.channel.name.startsWith("examen-")) {
      msg.channel.send("🗑️ Eliminando canal de examen...");
      setTimeout(() => msg.channel.delete().catch(() => {}), 3000);
    }
    return;
  }

  // ===============================
  // Respuestas dentro del canal de examen
  // ===============================
  const usuarioId = Object.keys(progreso).find(key => progreso[key].canalId === msg.channel.id);
  if (!usuarioId) return;

  if (msg.author.id !== usuarioId) {
    msg.reply("🚫 No se puede mandar mensaje en el examen de otro estudiante.");
    return;
  }

  const data = progreso[usuarioId];
  const respuesta = msg.content.trim();
  if (!/^[1-9]\d*$/.test(respuesta)) return;

  const { modulo, indice } = data;
  const pregunta = PREGUNTAS[modulo][indice];
  const preguntas = PREGUNTAS[modulo];

  if (respuesta === pregunta.respuesta.toString()) {
    data.puntos++;
    msg.reply("✅ Correcto!");
  } else {
    const correcta = pregunta.opciones[pregunta.respuesta - 1];
    msg.reply(`❌ Incorrecto. La respuesta era: ${pregunta.respuesta}. ${correcta}`);
  }

  const siguiente = preguntas[indice + 1];
  if (!siguiente) {
    const total = preguntas.length;
    const porcentaje = (data.puntos / total) * 100;

    if (porcentaje < 60) {
      msg.channel.send(`❌ Has reprobado, intenta repasar e intentarlo de nuevo en 24 h.\n📊 Puntuación: ${data.puntos}/${total}`);
      data.puntos = 0;
      data.indice = 0;
      guardarProgreso();
    } else {
      msg.channel.send(`🎉 Felicitaciones, has aprobado el módulo.\n📊 Puntuación: ${data.puntos}/${total}`);

      const modulos = Object.keys(PREGUNTAS);
      const actualIndex = modulos.indexOf(modulo);
      const siguienteModulo = modulos[actualIndex + 1];
      const rol = msg.guild.roles.cache.find(r => r.name === ROLES[siguienteModulo]);
      if (rol) {
        const member = await msg.guild.members.fetch(msg.author.id);
        member.roles.add(rol).catch(() => {});
      }
      data.modulo = siguienteModulo;
      data.indice = 0;
      data.puntos = 0;
      guardarProgreso();
    }

    msg.channel.send("🕒 Este canal se eliminará en 30 segundos...");
    setTimeout(() => msg.channel.delete().catch(() => {}), 30000);
    return;
  }

  data.indice++;
  guardarProgreso();
  setTimeout(() => enviarPregunta(msg.channel, usuarioId), 2000);
});

client.once("ready", () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
});

client.login(process.env.TOKEN);














