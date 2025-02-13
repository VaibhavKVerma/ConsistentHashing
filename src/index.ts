import express, { Request, Response } from 'express';
import { generateHash, getPort, addHashToRing, removeHashFromRing } from './consistentHashing';
import bodyParser from 'body-parser';
import axios from 'axios';

const HEALTH_CHECK_TIMEOUT = Number(process.env.HEALTH_CHECK_TIMEOUT) || 1000;

interface StartServerRequest {
    port: number;
}

interface StopServerRequest {
    port: number;
}

async function checkHealth(port: number): Promise<boolean> {
    try {
        const response = await axios.get(`http://localhost:${port}/healthCheck`, {
            timeout: HEALTH_CHECK_TIMEOUT,
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

async function performHealthChecks() {
    const portsToCheck = Array.from(activePorts);

    for (const port of portsToCheck) {
        const isHealthy = await checkHealth(port);

        if (!isHealthy) {
            console.log(`Server on port ${port} is unhealthy. Removing from active servers.`);

            activePorts.delete(port);
            const positions = generateHash(port);
            removeHashFromRing(positions);
        } else {
            console.log(`Server on port ${port} is healthy.`);
        }
    }
    console.log('Health checks completed.Active servers:', activePorts);
}

function startHealthChecks() {
    setInterval(performHealthChecks, 5000);
}

startHealthChecks();

const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 5000;

const activePorts = new Set<number>();

async function forwardRequestToServer(req: Request, res: Response) {
    const targetPort = await getPort();

    if (!targetPort) {
        return res.status(500).send('No active servers available');
    }

    try {
        const response = await axios({
            method: req.method,
            url: `http://localhost:${targetPort}${req.originalUrl}`,
            headers: req.headers,
            data: req.body,
        });

        res.status(response.status).send(response.data);
    } catch (error) {
        console.error('Error forwarding the request:', error);
        res.status(500).send('Error in making the request to the server');
    }
}

app.post('/addPort', (req: Request, res: Response) => {
    const { port }: StartServerRequest = req.body;

    if (activePorts.has(port)) {
        res.status(400).send('Port is already in use');
    }

    activePorts.add(port);
    const positions = generateHash(port);
    addHashToRing(positions, port);

    res.status(200).send(`Server creation requested on port ${port}`);
});

app.delete('/removePort', (req: Request, res: Response) => {
    const { port }: StopServerRequest = req.body;

    if (!activePorts.has(port)) {
        res.status(400).send('Port is not found');
    }

    activePorts.delete(port);
    const positions = generateHash(port);
    removeHashFromRing(positions);

    res.send(`Server on port ${port} has been stopped.`);
});

app.get('/healthCheck', async (req: Request, res: Response) => {
    res.status(200).send('Healthy');
});

app.all('*', async (req: Request, res: Response) => {
    await forwardRequestToServer(req, res);
});

app.listen(port, () => {
    console.log('Load Balancer is running on port ' + port);
});
