const fs = require('fs');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 📁 Cargar preguntas
const PREGUNTAS = JSON.parse(fs.readFileSync('preguntas.json', 'utf8'));

// 📘 Archivo donde se guarda el progreso
const PROGRESO_FILE = 'progreso.json';

// 🔁 Cargar progreso si existe
let progreso = {};
if (fs.existsSync(PROGRESO_FILE)) {
  progreso = JSON.parse(fs.readFileSync(PROGRESO_FILE, 'utf8'));
}

// 💾 Guardar progreso
function guardarProgreso() {
  fs.writeFileSync(PROGRESO_FILE, JSON.stringify(progreso, null, 2));
}

// 📖 Enviar pregunta actual
function enviarPregunta(msg, id) {
  const { modulo, indice } = progreso[id];
  const pregunta = PREGUNTAS[modulo][indice];
  let opcionesTexto = '';

  pregunta.opciones.forEach((op, i) => {
    opcionesTexto += `${i + 1}. ${op}\n`;
  });

  msg.reply(`**${pregunta.pregunta}**\n${opcionesTexto}\nResponde con el número de la opción correcta.`);
}

// 🧩 Avanzar pregunta o pasar al siguiente módulo (CORREGIDO)
function avanzarPregunta(msg, id) {
  const { modulo, indice, puntos } = progreso[id];
  const preguntas = PREGUNTAS[modulo];
  const siguiente = preguntas[indice + 1];

  // 🟡 Si no hay más preguntas, pasar al siguiente módulo
  if (!siguiente) {
    const modulos = Object.keys(PREGUNTAS);
    const actualIndex = modulos.indexOf(modulo);
    const siguienteModulo = modulos[actualIndex + 1];

    if (siguienteModulo) {
      msg.reply(`✅ ¡Completaste el módulo **${modulo}** con ${puntos}/${preguntas.length} puntos!\n➡️ Ahora comienza el siguiente módulo: **${siguienteModulo}**`);
      progreso[id] = { modulo: siguienteModulo, indice: 0, puntos: 0 };
      guardarProgreso();

      // Esperar 2 segundos y mandar la primera pregunta del nuevo módulo
      setTimeout(() => {
        enviarPregunta(msg, id);
      }, 2000);
    } else {
      // Si ya no hay más módulos, finalizar examen
      msg.reply(`🏁 ¡Examen finalizado por completo! Puntuación total: ${puntos}/${preguntas.length}`);
      delete progreso[id];
      guardarProgreso();
    }

    return;
  }

  // 🟢 Si todavía hay preguntas pendientes, avanzar normalmente
  progreso[id].indice++;
  guardarProgreso();
  enviarPregunta(msg, id);
}

// 🎮 Evento principal
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  const id = msg.author.id;
  const contenido = msg.content.trim().toLowerCase();

  // ⚙️ Comando para reiniciar progreso (solo admins)
  if (contenido.startsWith('!reset')) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      msg.reply('❌ No tienes permiso para usar este comando.');
      return;
    }

    const mencionado = msg.mentions.users.first();
    if (!mencionado) {
      msg.reply('⚠️ Debes mencionar a un usuario. Ejemplo: `!reset @usuario`');
      return;
    }

    if (progreso[mencionado.id]) {
      delete progreso[mencionado.id];
      guardarProgreso();
      msg.reply(`🔁 Se reinició el progreso de **${mencionado.username}**.`);
    } else {
      msg.reply(`ℹ️ **${mencionado.username}** no tenía progreso registrado.`);
    }

    return;
  }

  // 📘 Comando para iniciar examen
  if (contenido.startsWith('!examen')) {
    if (progreso[id]) {
      msg.reply(`📘 Continuando tu examen del módulo **${progreso[id].modulo}**.`);
      enviarPregunta(msg, id);
      return;
    }

    // Iniciar desde el primer módulo
    const primerModulo = Object.keys(PREGUNTAS)[0];
    progreso[id] = { modulo: primerModulo, indice: 0, puntos: 0 };
    guardarProgreso();
    msg.reply(`🧩 Iniciando examen del módulo **${primerModulo}**.`);
    enviarPregunta(msg, id);
    return;
  }

  // 📚 Comprobación de respuesta durante el examen
  if (progreso[id]) {
    const { modulo, indice } = progreso[id];
    const pregunta = PREGUNTAS[modulo][indice];
    const respuesta = msg.content.trim();

    if (respuesta === pregunta.respuesta.toString()) {
      progreso[id].puntos++;
      msg.reply('✅ ¡Correcto!');
    } else {
      const correcta = pregunta.opciones[parseInt(pregunta.respuesta) - 1];
      msg.reply(`❌ Incorrecto. La respuesta era: ${correcta}`);
    }

    guardarProgreso();
    setTimeout(() => avanzarPregunta(msg, id), 2000);
  }
});

// 🟢 Confirmar inicio del bot
client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
});

client.login(process.env.TOKEN);












