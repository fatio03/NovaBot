// commands/examen.js
const fs = require('fs');
const path = require('path');

const rutaResultados = path.join(__dirname, '../data/resultados.json');
const rutaPreguntas = path.join(__dirname, '../preguntas.json');

function cargarResultados() {
  if (!fs.existsSync(rutaResultados)) return {};
  return JSON.parse(fs.readFileSync(rutaResultados, 'utf8'));
}

function guardarResultados(data) {
  fs.writeFileSync(rutaResultados, JSON.stringify(data, null, 2));
}

const modulos = [
  'simbolos',
  'teoria_de_conjuntos',
  'tabla_de_verdad',
  'condicionales',
  'ciclos',
  'subprogramas',
  'vectores'
];

// 🎓 Roles exactos por módulo
const rolesPorModulo = {
  simbolos: 'Módulo 1 - Símbolos',
  teoria_de_conjuntos: 'Módulo 2 - Teoría de Conjuntos',
  tabla_de_verdad: 'Módulo 3 - Tabla de Verdad',
  condicionales: 'Módulo 4 - Condicionales',
  ciclos: 'Módulo 5 - Ciclos',
  subprogramas: 'Módulo 6 - Subprogramas',
  vectores: 'Módulo 7 - Vectores'
};

module.exports = {
  name: 'examen',
  description: 'Realiza el examen del módulo actual y asigna el rol del siguiente módulo al aprobar.',

  async execute(message) {
    const canalPermitido = 'examenes';
    if (message.channel.name !== canalPermitido)
      return message.reply(`❌ Solo podés rendir en el canal **#${canalPermitido}**.`);

    const userId = message.author.id;
    const resultados = cargarResultados();

    if (!resultados[userId]) {
      return message.reply('⚠️ No estás registrada. Usa `!iniciar` para comenzar.');
    }

    const user = resultados[userId];
    const moduloActual = modulos[user.moduloActual];
    const moduloData = user.modulos[moduloActual];

    const preguntas = JSON.parse(fs.readFileSync(rutaPreguntas, 'utf8'));
    const preguntasModulo = preguntas[moduloActual];
    if (!preguntasModulo) return message.reply('⚠️ No hay preguntas registradas para este módulo.');

    const hoy = new Date().toISOString().slice(0, 10);
    if (moduloData.ultimoIntento === hoy && !moduloData.aprobado) {
      return message.reply('❌ Ya reprobaste hoy. Podrás volver a intentarlo mañana.');
    }

    await message.channel.send(`📘 Examen del módulo **${moduloActual}**. Responde correctamente las siguientes preguntas:`);

    let correctas = 0;
    let respondidas = 0;

    for (let i = 0; i < preguntasModulo.length; i++) {
      const p = preguntasModulo[i];
      const opcionesTexto = p.opciones.map((op, idx) => `${idx + 1}. ${op}`).join('\n');
      await message.channel.send(`**${i + 1}. ${p.pregunta}**\n${opcionesTexto}`);

      const filter = m => m.author.id === userId;
      const respuesta = await message.channel.awaitMessages({ filter, max: 1, time: 25000 }).catch(() => null);

      if (!respuesta || !respuesta.first()) {
        await message.channel.send('⏰ Tiempo agotado. No respondiste la pregunta. Vuelve a hacer el examen desde el inicio.');
        return; // 🛑 Finaliza el examen sin marcar reprobación ni guardar intento
      }

      respondidas++;

      const contenido = respuesta.first().content.trim().toLowerCase();
      const indice = parseInt(contenido) - 1;
      const opcionElegida = isNaN(indice) ? contenido : p.opciones[indice]?.toLowerCase();

      if (opcionElegida === p.respuesta.toLowerCase()) {
        correctas++;
        await message.channel.send('✅ Correcto.');
      } else {
        await message.channel.send(`❌ Incorrecto. Era: **${p.respuesta}**`);
      }
    }

    const porcentaje = respondidas > 0 ? (correctas / respondidas) * 100 : 0;

    moduloData.puntaje = Math.round(porcentaje);
    moduloData.aprobado = porcentaje >= 60 && respondidas > 0;
    moduloData.ultimoIntento = hoy;
    guardarResultados(resultados);

    // 💯 Si aprobó
    if (moduloData.aprobado) {
      await message.channel.send(`🎉 Aprobaste el módulo **${moduloActual}** con ${moduloData.puntaje}% de aciertos.`);

      const guild = message.guild;
      const miembro = await guild.members.fetch(userId).catch(() => null);

      // Asignar el rol del SIGUIENTE módulo
      if (miembro) {
        const siguienteModulo = modulos[user.moduloActual + 1];
        const rolSiguiente = rolesPorModulo[siguienteModulo];

        if (rolSiguiente) {
          const rol = guild.roles.cache.find(r => r.name === rolSiguiente);
          if (rol) {
            await miembro.roles.add(rol).catch(() => null);
            await message.channel.send(`🎓 ¡Felicitaciones ${message.author.username}! Se te añadió el rol **${rolSiguiente}**.`);
          } else {
            await message.channel.send(`⚠️ No encontré el rol **${rolSiguiente}**. Crealo en el servidor.`);
          }
        } else {
          await message.channel.send('🏁 ¡Completaste todos los módulos!');
        }
      }

      // Avanzar al siguiente módulo
      if (user.moduloActual < modulos.length - 1) {
        user.moduloActual++;
        user.nombreModuloActual = modulos[user.moduloActual];
        guardarResultados(resultados);
        await message.channel.send(`➡️ Ahora pasás al siguiente módulo: **${user.nombreModuloActual}**.`);
      } else {
        await message.channel.send('🏁 ¡Has finalizado todos los módulos! 🎓');
      }

    } else {
      await message.channel.send(`😞 Reprobaste con ${moduloData.puntaje}%. Podrás intentarlo mañana.`);
    }
  }
};







