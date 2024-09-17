const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(bodyParser.json());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = 3001;

let clients = [];

wss.on('connection', function connection(ws) {
  console.log('Client connected');
  clients.push(ws);

  ws.on('close', () => {
    console.log('Client disconnected');
    clients = clients.filter((client) => client !== ws);
  });
});

app.post('/bookings', (req, res) => {
  console.log(req.body);
  console.log('Sending test data to client...');
  clients.forEach((client) => client.send('ADD:' + JSON.stringify(req.body)));
  res.send({ status: 200, message: 'Success' });
});

server.listen(port, () => {
  console.log('Server started on port ' + port);
});
