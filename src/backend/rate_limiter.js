export class RateLimiter {
    #queue = [];
    #running = false;
    #cooldownMs;

    constructor(cooldownMs = 1000) {
        this.#cooldownMs = cooldownMs;
    }

    enqueue(fn) {
        return new Promise((resolve, reject) => {
            this.#queue.push({ fn, resolve, reject });
            this.#process();
        });
    }

    async #process() {
        if (this.#running) return;
        this.#running = true;

        while (this.#queue.length > 0) {
            const { fn, resolve, reject } = this.#queue.shift();
            try {
                const result = await fn();
                resolve(result);
            } catch (e) {
                reject(e);
            }
            await sleep(this.#cooldownMs);
        }

        this.#running = false;
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

const limiters = new Map();

export function getLimiter(providerId, cooldownMs = 1000) {
    if (!limiters.has(providerId)) {
        limiters.set(providerId, new RateLimiter(cooldownMs));
    }
    return limiters.get(providerId);
}
