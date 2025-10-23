// commands/iniciar.js
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

// 📚 Definición de módulos
const modulos = [
  { nombre: 'simbolos', display: 'Módulo 1 - Símbolos', rol: 'Módulo 1 - Símbolos', descripcion: 'Aquí aprenderás los símbolos lógicos básicos.' },
  { nombre: 'teoria_de_conjuntos', display: 'Módulo 2 - Teoría de Conjuntos', rol: 'Módulo 2 - Teoría de Conjuntos', descripcion: 'Conjuntos, unión, intersección, etc.' },
  { nombre: 'tabla_de_verdad', display: 'Módulo 3 - Tabla de Verdad', rol: 'Módulo 3 - Tabla de Verdad', descripcion: 'Cómo construir tablas de verdad.' },
  { nombre: 'condicionales', display: 'Módulo 4 - Condicionales', rol: 'Módulo 4 - Condicionales', descripcion: 'If, else y condicionales lógicas.' },
  { nombre: 'ciclos', display: 'Módulo 5 - Ciclos', rol: 'Módulo 5 - Ciclos', descripcion: 'For, while y bucles.' },
  { nombre: 'subprogramas', display: 'Módulo 6 - Subprogramas', rol: 'Módulo 6 - Subprogramas', descripcion: 'Funciones y procedimientos.' },
  { nombre: 'vectores', display: 'Módulo 7 - Vectores', rol: 'Módulo 7 - Vectores', descripcion: 'Vectores y manejo básico.' }
];

module.exports = {
  name: 'iniciar',
  description: 'Registra al usuario, asigna su primer rol y muestra el módulo actual.',

  async execute(message) {
    const guild = message.guild;
    if (!guild) return message.channel.send('❌ Este comando solo funciona dentro de un servidor.');

    const userId = message.author.id;
    const resultados = cargarResultados();

    // Registro inicial
    if (!resultados[userId]) {
      resultados[userId] = {
        id: userId,
        moduloActual: 0,
        nombreModuloActual: modulos[0].nombre,
        modulos: {},
        examenEnCurso: false
      };

      modulos.forEach(m => {
        resultados[userId].modulos[m.nombre] = {
          puntaje: null,
          aprobado: false,
          ultimoIntento: ''
        };
      });

      guardarResultados(resultados);

      // 🧩 Asignar rol del primer módulo
      const rolNombre = modulos[0].rol;
      const rol = guild.roles.cache.find(r => r.name === rolNombre);
      const miembro = await guild.members.fetch(userId);

      if (rol && miembro) {
        await miembro.roles.add(rol).catch(() => null);
        await message.channel.send(`🎓 Se te asignó el rol **${rolNombre}**.`);
      } else {
        await message.channel.send(`⚠️ No encontré el rol **${rolNombre}**. Asegurate de crearlo en el servidor.`);
      }

      await message.channel.send(
        `✅ Te registré correctamente.\n` +
        `Comenzás en **${modulos[0].display}**.\n` +
        `Descripción: ${modulos[0].descripcion}\n` +
        `Usá \`!examen\` en **#examenes** cuando quieras rendir.`
      );
    } else {
      const user = resultados[userId];
      const actual = modulos[user.moduloActual] || modulos[0];
      await message.channel.send(
        `📘 Ya estás registrada.\n` +
        `Tu módulo actual es **${actual.display}**.\n` +
        `Usá \`!examen\` en **#examenes** para rendir.`
      );
    }
  }
};







