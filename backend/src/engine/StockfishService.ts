import { spawn } from 'child_process'
import path from 'path'

export interface EvaluationResult {
    type: 'cp' | 'mate'
    value: number
    bestMove?: string
}

export class StockfishService {
    private stockfishPath: string

    constructor() {
        this.stockfishPath = process.env.STOCKFISH_PATH || '/usr/local/bin/fairy-stockfish'
    }

    /**
     * Evaluate a position using Fairy-Stockfish
     * @param fen FEN string of the position
     * @param depth Search depth (default: 15)
     */
    async evaluate(fen: string, depth: number = 10): Promise<EvaluationResult> {
        return new Promise((resolve, reject) => {
            // variants.ini is in backend root (where package.json is)
            const cwd = path.resolve(process.cwd()) // Assuming process runs from backend root

            console.log(`🧠 Spawning Stockfish: ${this.stockfishPath} (cwd: ${cwd})`)

            let sf: any
            try {
                sf = spawn(this.stockfishPath, [], { cwd })
            } catch (e) {
                return reject(`Failed to spawn stockfish: ${e}`)
            }

            let bestMoveFound = false
            let lastScore: { type: 'cp' | 'mate', value: number } | null = null

            sf.stdout.on('data', (data: any) => {
                const output = data.toString()
                // console.log(`[Stockfish] ${output}`) 

                const lines = output.split('\n')
                for (const line of lines) {
                    // Parse score: info depth ... score cp 100 ...
                    if (line.includes('score')) {
                        const parts = line.split(' ')
                        const scoreIndex = parts.indexOf('score')
                        if (scoreIndex !== -1) {
                            const type = parts[scoreIndex + 1] // cp or mate
                            const value = parseInt(parts[scoreIndex + 2])

                            if (type === 'cp' || type === 'mate') {
                                lastScore = { type, value }
                            }
                        }
                    }

                    // Parse bestmove to finish
                    if (line.startsWith('bestmove')) {
                        const parts = line.split(' ')
                        const bestMove = parts[1]
                        bestMoveFound = true

                        sf.kill() // Terminate process

                        if (lastScore) {
                            resolve({
                                type: lastScore.type,
                                value: lastScore.value,
                                bestMove
                            })
                        } else {
                            // Should not happen if analysis ran
                            resolve({ type: 'cp', value: 0, bestMove })
                        }
                    }
                }
            })

            sf.stderr.on('data', (data: any) => {
                console.error(`[Stockfish Error] ${data}`)
            })

            sf.on('error', (err: any) => {
                console.error(`[Stockfish Failed] ${err}`)
                reject(err)
            })

            // Send commands sequence
            sf.stdin.write(`uci\n`)

            // Wait a bit or accept uciok? Best to just send config.
            // Fairy-Stockfish needs variant set
            const variantPath = path.join(cwd, 'variants.ini')
            sf.stdin.write(`setoption name VariantPath value ${variantPath}\n`)
            sf.stdin.write(`setoption name UCI_Variant value madchess\n`)
            sf.stdin.write(`isready\n`)
            sf.stdin.write(`position fen ${fen}\n`)
            sf.stdin.write(`go depth ${depth}\n`)
        })
    }
}
