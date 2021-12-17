import 'source-map-support/register';
import {createServer} from 'http';

const CLOUD_RUN_DEFAULT_PORT = 8080;
const PORT = process.env.PORT || CLOUD_RUN_DEFAULT_PORT;

let count = 1;

const server = createServer((req, res) => {
  const path = req.url ?? '/';
  res.writeHead(200, {'Content-Type': 'application/json'});

  switch (path) {
    case '/ping': {
      res.write(JSON.stringify({pong: count++}));
      console.log(`count: ${count}`);
      break;
    }
    default: {
      res.write(JSON.stringify({message: 'hello world!'}));
      break;
    }
  }

  res.end();
});

(async () => {
  server.listen(PORT);

  console.log('app is running!');

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, terminate server.');
    server.close();
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, terminate server.');
    server.close();
  });
})();
