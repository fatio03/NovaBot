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

// Cargar preguntas y progreso
const PREGUNTAS = JSON.parse(fs.readFileSync("preguntas.json", "utf8"));
const PROGRESO_FILE = "progreso.json";
let progreso = fs.existsSync(PROGRESO_FILE)
  ? JSON.parse(fs.readFileSync(PROGRESO_FILE, "utf8"))
  : {};

function guardarProgreso() {
  fs.writeFileSync(PROGRESO_FILE, JSON.stringify(progreso, null, 2));
}

const CANAL_EXAMEN_GENERAL = "examenes";

// ==========================
// 📘 Enviar pregunta
// ==========================
function enviarPregunta(canal, id) {
  const { modulo, indice } = progreso[id];
  const pregunta = PREGUNTAS[modulo][indice];
  let opcionesTexto = "";

  pregunta.opciones.forEach((op, i) => {
    opcionesTexto += `${i + 1}. ${op}\n`;
  });

  canal.send(`**${pregunta.pregunta}**\n${opcionesTexto}\n✏️ Responde con el número de la opción correcta.`);
}

// ==========================
// 🔒 Crear canal privado
// ==========================
async function crearCanalPrivado(guild, usuario) {
  const canal = await guild.channels.create({
    name: `examen-${usuario.username.toLowerCase()}`,
    type: 0, // canal de texto
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

// ==========================
// 🧠 Lógica principal
// ==========================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const id = msg.author.id;
  const contenido = msg.content.trim().toLowerCase();

  // 🔹 Iniciar examen desde el canal general
  if (msg.channel.name === CANAL_EXAMEN_GENERAL && contenido.startsWith("!examen")) {
    if (!progreso[id]) {
      const primerModulo = Object.keys(PREGUNTAS)[0];
      progreso[id] = { modulo: primerModulo, indice: 0, puntos: 0, finalizado: false, canalId: null };
      guardarProgreso();
    }

    const usuario = msg.author;
    let canal;

    // Verificar canal existente
    if (progreso[id].canalId) {
      canal = msg.guild.channels.cache.get(progreso[id].canalId);
      if (!canal) progreso[id].canalId = null;
    }

    // Crear nuevo canal si no existe
    if (!progreso[id].canalId) {
      canal = await crearCanalPrivado(msg.guild, usuario);
      progreso[id].canalId = canal.id;
      guardarProgreso();
      canal.send(`👋 ¡Hola ${usuario.username}! Este es tu canal privado para realizar el examen.`);
    } else {
      canal = msg.guild.channels.cache.get(progreso[id].canalId);
    }

    // Verificar si ya finalizó módulo
    if (progreso[id].finalizado) {
      const modulos = Object.keys(PREGUNTAS);
      const actualIndex = modulos.indexOf(progreso[id].modulo);
      const siguienteModulo = modulos[actualIndex + 1];

      if (siguienteModulo) {
        progreso[id] = { modulo: siguienteModulo, indice: 0, puntos: 0, finalizado: false, canalId: canal.id };
        guardarProgreso();
        canal.send(`➡️ Comenzando el siguiente módulo: **${siguienteModulo}**`);
        enviarPregunta(canal, id);
      } else {
        canal.send("🏁 ¡Ya completaste todos los módulos del curso! 🎉");
      }
      return;
    }

    canal.send(`🧩 Iniciando examen del módulo **${progreso[id].modulo}**.`);
    enviarPregunta(canal, id);
    return;
  }

  // 🔹 Si se responde dentro de un canal privado de examen
  const usuarioId = Object.keys(progreso).find(key => progreso[key].canalId === msg.channel.id);
  if (!usuarioId) return;

  // ⚠️ Evitar respuestas de otros usuarios
  if (msg.author.id !== usuarioId) {
    msg.reply("⚠️ Este examen pertenece a otro usuario. No puedes responder aquí.");
    return;
  }

  const data = progreso[usuarioId];

  if (data.finalizado) {
    msg.reply("⚠️ Ya terminaste este módulo. Usa **!examen** en el canal general para continuar al siguiente.");
    return;
  }

  const respuesta = msg.content.trim();
  if (!/^[1-9]\d*$/.test(respuesta)) return;

  const { modulo, indice } = data;
  const pregunta = PREGUNTAS[modulo][indice];

  if (respuesta === pregunta.respuesta.toString()) {
    data.puntos++;
    msg.reply("✅ ¡Correcto!");
  } else {
    const correcta = pregunta.opciones[pregunta.respuesta - 1];
    msg.reply(`❌ Incorrecto. La respuesta era: ${pregunta.respuesta}. ${correcta}`);
  }

  const preguntas = PREGUNTAS[modulo];
  const siguiente = preguntas[indice + 1];

  if (!siguiente) {
    data.finalizado = true;
    guardarProgreso();
    msg.reply(`🎓 ¡Completaste el módulo **${modulo}** con ${data.puntos}/${preguntas.length} puntos!\nUsa **!examen** en el canal general cuando quieras rendir el siguiente módulo.`);

    // 🔹 Borrar canal después de 30 segundos
    setTimeout(() => {
      msg.channel.delete().catch(console.error);
      data.canalId = null;
      guardarProgreso();
    }, 30000);

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











