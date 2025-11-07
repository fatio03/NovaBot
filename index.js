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

// Archivos base
const PREGUNTAS = JSON.parse(fs.readFileSync("preguntas.json", "utf8"));
const PROGRESO_FILE = "progreso.json";

let progreso = fs.existsSync(PROGRESO_FILE)
  ? JSON.parse(fs.readFileSync(PROGRESO_FILE, "utf8"))
  : {};

function guardarProgreso() {
  fs.writeFileSync(PROGRESO_FILE, JSON.stringify(progreso, null, 2));
}

// Roles reales del servidor
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
  let opcionesTexto = "";

  pregunta.opciones.forEach((op, i) => {
    opcionesTexto += `${i + 1}. ${op}\n`;
  });

  canal.send(
    `**${pregunta.pregunta}**\n${opcionesTexto}\n✏️ Responde con el número de la opción correcta.`
  );
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

// Evento principal
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const id = msg.author.id;
  const contenido = msg.content.trim().toLowerCase();

  // ========================
  // !examen
  // ========================
  if (contenido.startsWith("!examen")) {
    if (!progreso[id]) {
      const primerModulo = Object.keys(PREGUNTAS)[0];
      progreso[id] = {
        modulo: primerModulo,
        indice: 0,
        puntos: 0,
        canalId: null,
        bloqueadoHasta: null
      };
      guardarProgreso();
    }

    const usuario = msg.author;
    const userData = progreso[id];

    if (userData.bloqueadoHasta && Date.now() < userData.bloqueadoHasta) {
      const falta = Math.ceil((userData.bloqueadoHasta - Date.now()) / 3600000);
      msg.reply(`⏳ Aún no puedes volver a intentar. Faltan ${falta} h.`);
      return;
    }

    let canal;
    if (userData.canalId) {
      canal = msg.guild.channels.cache.get(userData.canalId);
      if (!canal) userData.canalId = null;
    }

    if (!userData.canalId) {
      canal = await crearCanalPrivado(msg.guild, usuario);
      userData.canalId = canal.id;
      guardarProgreso();
      canal.send(`👋 ¡Hola ${usuario.username}! Este es tu canal privado de examen del módulo **${userData.modulo}**.`);
      enviarPregunta(canal, id);
    } else {
      canal.send(`🔄 Continuando examen del módulo **${userData.modulo}**.`);
      enviarPregunta(canal, id);
    }
    return;
  }

  // ========================
  // !reset @usuario
  // ========================
  if (contenido.startsWith("!reset") && msg.member.permissions.has("Administrator")) {
    const usuarioMencionado = msg.mentions.users.first();
    if (!usuarioMencionado) return msg.reply("❌ Debes mencionar a un usuario.");
    delete progreso[usuarioMencionado.id];
    guardarProgreso();
    return msg.reply(`♻️ El progreso de ${usuarioMencionado.username} fue reiniciado.`);
  }

  // ========================
  // !puntaje @usuario @modulo
  // ========================
  if (contenido.startsWith("!puntaje")) {
    const partes = contenido.split(" ");
    const usuarioMencionado = msg.mentions.users.first();
    const modulo = partes[2];
    if (!usuarioMencionado || !modulo) {
      return msg.reply("Uso: !puntaje @usuario modulo");
    }

    const data = progreso[usuarioMencionado.id];
    if (!data || data.modulo !== modulo) {
      return msg.reply("No hay datos de ese usuario en ese módulo.");
    }

    return msg.reply(
      `📊 Puntaje de ${usuarioMencionado.username} en **${modulo}**: ${data.puntos}/${PREGUNTAS[modulo].length}`
    );
  }

  // ========================
  // Respuestas dentro del canal de examen
  // ========================
  const usuarioId = Object.keys(progreso).find(
    (key) => progreso[key].canalId === msg.channel.id
  );

  if (!usuarioId) return; // No es canal de examen

  const usuarioData = progreso[usuarioId];

  // ⚠️ Evitar respuestas de otros usuarios
  if (msg.author.id !== usuarioId) {
    msg.reply("🚫 No se puede mandar mensaje en el examen de otro estudiante.");
    return;
  }

  const respuesta = msg.content.trim();
  if (!/^[1-9]\d*$/.test(respuesta)) return;

  const { modulo, indice } = usuarioData;
  const pregunta = PREGUNTAS[modulo][indice];

  if (respuesta === pregunta.respuesta.toString()) {
    usuarioData.puntos++;
    msg.reply("✅ ¡Correcto!");
  } else {
    const correcta = pregunta.opciones[pregunta.respuesta - 1];
    msg.reply(`❌ Incorrecto. La respuesta era: ${pregunta.respuesta}. ${correcta}`);
  }

  const preguntas = PREGUNTAS[modulo];
  const siguiente = preguntas[indice + 1];

  if (!siguiente) {
    const total = preguntas.length;
    const porcentaje = (usuarioData.puntos / total) * 100;

    if (porcentaje < 60) {
      msg.channel.send(`❌ Has reprobado, intenta repasar e intentarlo de nuevo en 24 h.\n📊 Puntuación: ${usuarioData.puntos}/${total}`);
      usuarioData.bloqueadoHasta = Date.now() + 24 * 60 * 60 * 1000;
      usuarioData.indice = 0;
      usuarioData.puntos = 0;
      guardarProgreso();
      setTimeout(() => msg.channel.delete().catch(() => {}), 30000);
      return;
    }

    msg.channel.send(`🎉 Felicitaciones, has aprobado el módulo.\n📊 Puntuación: ${usuarioData.puntos}/${total}`);

    const modulos = Object.keys(PREGUNTAS);
    const actualIndex = modulos.indexOf(modulo);
    const siguienteModulo = modulos[actualIndex + 1];

    const guildMember = await msg.guild.members.fetch(msg.author.id);
    const rolSiguiente = ROLES[siguienteModulo];
    if (rolSiguiente) {
      const rol = msg.guild.roles.cache.find(r => r.name === rolSiguiente);
      if (rol) await guildMember.roles.add(rol);
    }

    usuarioData.modulo = siguienteModulo;
    usuarioData.indice = 0;
    usuarioData.puntos = 0;
    guardarProgreso();

    msg.channel.send("🕒 Este canal se eliminará en 30 segundos...");
    setTimeout(() => msg.channel.delete().catch(() => {}), 30000);
    return;
  }

  usuarioData.indice++;
  guardarProgreso();
  setTimeout(() => enviarPregunta(msg.channel, usuarioId), 1500);
});

client.once("ready", () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
});

client.login(process.env.TOKEN);













