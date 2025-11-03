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
async function enviarPregunta(canal, id) {
  const { modulo, indice } = progreso[id];
  const pregunta = PREGUNTAS[modulo][indice];
  let opcionesTexto = '';

  pregunta.opciones.forEach((op, i) => {
    opcionesTexto += `${i + 1}. ${op}\n`;
  });

  await canal.send(`**${pregunta.pregunta}**\n${opcionesTexto}\nResponde con el número de la opción correcta.`);
}

// 🧩 Avanzar pregunta o pasar al siguiente módulo
async function avanzarPregunta(canal, id, usuario) {
  const { modulo, indice, puntos } = progreso[id];
  const preguntas = PREGUNTAS[modulo];
  const siguiente = preguntas[indice + 1];

  // Si no hay más preguntas, pasar al siguiente módulo
  if (!siguiente) {
    const modulos = Object.keys(PREGUNTAS);
    const actualIndex = modulos.indexOf(modulo);
    const siguienteModulo = modulos[actualIndex + 1];

    // 🎯 Roles por módulo (nombres reales de tu servidor)
    const roles = {
      simbolos: "Módulo 1 - Símbolos",
      teoria_de_conjuntos: "Módulo 2 - Teoría de Conjuntos",
      tabla_de_verdad: "Módulo 3 - Tabla de Verdad",
      condicionales: "Módulo 4 - Condicionales",
      ciclos: "Módulo 5 - Ciclos",
      subprogramas: "Módulo 6 - Subprogramas",
      vectores: "Módulo 7 - Vectores"
    };

    const guildMember = await canal.guild.members.fetch(usuario.id);

    // Asignar rol del módulo actual
    const rolActual = roles[modulo];
    if (rolActual) {
      const rol = canal.guild.roles.cache.find(r => r.name === rolActual);
      if (rol) await guildMember.roles.add(rol).catch(() => {});
    }

    if (siguienteModulo) {
      await canal.send(`✅ ¡Completaste el módulo **${modulo}** con ${puntos}/${preguntas.length} puntos!`);
      await canal.send(`🏅 Se te ha asignado el rol **${roles[modulo]}**.`);
      await canal.send(`⏳ Avanzando al siguiente módulo **${siguienteModulo}** en 5 segundos...`);

      progreso[id] = { modulo: siguienteModulo, indice: 0, puntos: 0 };
      guardarProgreso();

      setTimeout(async () => {
        await canal.delete().catch(() => {});
        const nuevoCanal = await canal.guild.channels.create({
          name: `examen-${usuario.username}`,
          type: 0,
          permissionOverwrites: [
            {
              id: canal.guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: usuario.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            },
            {
              id: client.user.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }
          ]
        });

        await nuevoCanal.send(`🧩 ${usuario} bienvenido al siguiente módulo: **${siguienteModulo}**`);
        enviarPregunta(nuevoCanal, id);
      }, 5000);
    } else {
      await canal.send(`🏁 ¡Examen finalizado por completo! Puntuación total: ${puntos}/${preguntas.length}`);
      await canal.send(`🎉 Felicitaciones ${usuario.username}, completaste todos los módulos.`);
      delete progreso[id];
      guardarProgreso();
      await canal.send('🕒 Este canal se eliminará en 30 segundos...');
      setTimeout(() => canal.delete().catch(() => {}), 30000);
    }
    return;
  }

  // Si hay más preguntas
  progreso[id].indice++;
  guardarProgreso();
  enviarPregunta(canal, id);
}

// 🎮 Evento principal
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const id = msg.author.id;
  const contenido = msg.content.trim().toLowerCase();

  // ✅ Comando para iniciar examen
  if (contenido.startsWith('!examen')) {
    if (progreso[id]) {
      msg.reply('📘 Ya tenés un examen en curso. Terminá ese primero.');
      return;
    }

    const primerModulo = Object.keys(PREGUNTAS)[0];
    progreso[id] = { modulo: primerModulo, indice: 0, puntos: 0 };
    guardarProgreso();

    const canal = await msg.guild.channels.create({
      name: `examen-${msg.author.username}`,
      type: 0,
      permissionOverwrites: [
        {
          id: msg.guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: msg.author.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    await canal.send(`👋 ¡Hola ${msg.author}! Este es tu canal privado para el examen del módulo **${primerModulo}**.`);
    enviarPregunta(canal, id);
    return;
  }

  // 📚 Respuestas dentro de un canal de examen
  if (msg.channel.name.startsWith('examen-') && progreso[id]) {
    const { modulo, indice } = progreso[id];
    const pregunta = PREGUNTAS[modulo][indice];
    const respuesta = msg.content.trim();

    if (respuesta === pregunta.respuesta.toString()) {
      progreso[id].puntos++;
      await msg.channel.send('✅ ¡Correcto!');
    } else {
      const correcta = pregunta.opciones[parseInt(pregunta.respuesta) - 1];
      await msg.channel.send(`❌ Incorrecto. La respuesta era: ${correcta}`);
    }

    guardarProgreso();
    setTimeout(() => avanzarPregunta(msg.channel, id, msg.author), 2000);
  }
});

// 🟢 Confirmar inicio del bot
client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
});

client.login(process.env.TOKEN);












