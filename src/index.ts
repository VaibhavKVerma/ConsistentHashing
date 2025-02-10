import express, { Express, Request, Response } from 'express';
import { generateHash, hashFunction, getPort, addHashToRing, removeHashFromRing } from './consistentHashing';
import bodyParser from 'body-parser';
import axios from 'axios';

// Define interfaces for the expected structure of request bodies
interface StartServerRequest {
    port: number;
    ringValue: number;
}

interface StopServerRequest {
    port: number;
}

const app = express();

app.use(bodyParser.json());
const port = 5000;

const servers = new Map<number, { app: Express; httpServer: any }>();

app.post('/startNewServer', (req: Request, res: Response) => {
    const { port, ringValue }: StartServerRequest = req.body;

    if (!port || !ringValue || servers.has(port)) {
        res.status(400).send('Incorrect input');
        return;
    }

    const positions = generateHash(port, ringValue);
    addHashToRing(positions, port);

    const newServerApp = express();
    newServerApp.get('/testing', (req: Request, res: Response) => {
        res.send(`server running on port ${port}`);
    });

    res.status(200).send(`Server creation requested on port ${port}`);

    const httpServer = newServerApp.listen(port, () => {
        console.log(`Server started on port ${port}`);
    });

    console.log('Adding server');
    servers.set(port, { app: newServerApp, httpServer });
    console.log('Total Servers: ' + servers.size);
});

app.post('/stopServer', (req: Request, res: Response) => {
    const { port }: StopServerRequest = req.body;

    if (!port) {
        res.status(400).send('Port is required');
        return;
    }

    const positions = generateHash(port);
    removeHashFromRing(positions);

    const server = servers.get(port);
    if (!server) {
        res.status(404).send('Server not found');
        return;
    }

    console.log('Closing server');

    server.httpServer.close(() => {
        console.log(`Server on port ${port} closed successfully.`);
        servers.delete(port); // Remove from the Map
        console.log('Total Servers: ' + servers.size);
    });

    res.send(`Server on port ${port} has been stopped.`);
});

app.get('/testing', async (req: Request, res: Response) => {
    const port = getPort();
    const server = servers.get(port);
    if (!server) {
        res.status(404).send('Server not found');
        return;
    }

    try {
        const response = await axios.get(`http://localhost:${port}/testing`);
        res.send(response.data);
    } catch (error) {
        console.error('Error in making the request to the server:', error);
        res.status(500).send('Error in making the request to the server');
    }
});

app.get('/', (req: Request, res: Response) => {
    res.send('Welcome to my API');
});

app.listen(port, () => {
    console.log('Running on port ' + port);
});
