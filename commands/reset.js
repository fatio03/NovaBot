// commands/reset.js
const fs = require('fs');
const path = require('path');

const rutaResultados = path.join(__dirname, '../data/resultados.json');

function cargarResultados() {
  if (!fs.existsSync(rutaResultados)) return {};
  return JSON.parse(fs.readFileSync(rutaResultados, 'utf8'));
}

function guardarResultados(data) {
  fs.writeFileSync(rutaResultados, JSON.stringify(data, null, 2));
}

module.exports = {
  name: 'reset',
  description: 'Permite al administrador reiniciar el progreso de un usuario o de todos',

  async execute(message, args) {
    // 🛑 Solo administradores
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Solo los administradores pueden usar este comando.');
    }

    const resultados = cargarResultados();

    // ✅ Opción 1: reset de todos
    if (args[0] === 'todos') {
      for (const key in resultados) delete resultados[key];
      guardarResultados(resultados);
      return message.reply('⚠️ Todos los progresos han sido eliminados.');
    }

    // ✅ Opción 2: reset de un usuario específico
    const userMention = message.mentions.users.first();
    if (!userMention) {
      return message.reply('⚠️ Debes mencionar al usuario. Ejemplo: `!reset @usuario` o `!reset todos`');
    }

    const userId = userMention.id;
    if (!resultados[userId]) {
      return message.reply('⚠️ Ese usuario no estaba registrado.');
    }

    delete resultados[userId];
    guardarResultados(resultados);

    await message.channel.send(`✅ Se eliminó el progreso de ${userMention.tag}. Podrá volver a usar \`!iniciar\` para empezar desde cero.`);
  }
};
