// Enviar mensaje al main process
window.cerperAPI.send('canal-prueba', { mensaje: 'hi main' });

// Recibir mensaje del main process
window.cerperAPI.receive('canal-respuesta', (data) => {
  console.log('Respuesta del main:', data);
});


