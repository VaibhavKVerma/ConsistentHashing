import { createHash } from 'crypto';

const virtualNodesCount = 50;
const totalHashRingValues = 1e4;
const hashRing = new Map<number, number>();

const hashFunction = (value: string): number => {
    const hash = createHash('sha256').update(value).digest('hex');
    const position = parseInt(hash.substring(0, 4), 16);
    return position;
};

const generateHash = (port: number, ringValue: number = virtualNodesCount): number[] => {
    const positions: number[] = [];
    for (let i = 0; i < ringValue; i++) {
        positions.push(hashFunction(port + '_' + i));
    }
    return positions;
};

const addHashToRing = (positions: number[], port: number): void => {
    positions.forEach((element) => {
        hashRing.set(element, port);
    });
};

const removeHashFromRing = (positions: number[]): void => {
    positions.forEach((element) => {
        hashRing.delete(element);
    });
};

function upperBound(arr: number[], target: number): number {
    const n = arr.length;
    for (let i = 0; i < n; ++i) {
        if (arr[i] > target) {
            return i;
        }
    }
    return n;
}


const getPort = async (): Promise<number> => {
    const key = Math.floor(Math.random() * totalHashRingValues);
    const position = hashFunction(key + '');
    const servers = [...hashRing.keys()].sort((a, b) => a - b);

    const index = upperBound(servers, position);
    const port = index === servers.length ? hashRing.get(servers[0])! : hashRing.get(servers[index])!;
    return port;
};

export { totalHashRingValues, generateHash, hashFunction, addHashToRing, removeHashFromRing, getPort };
