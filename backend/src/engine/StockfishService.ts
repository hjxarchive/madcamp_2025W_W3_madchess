import { spawn } from 'child_process'
import path from 'path'

export interface AnalysisLine {
    id: number
    type: 'cp' | 'mate'
    value: number
    pv: string // Best move sequence
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
     * @param multiPV Number of lines to analyze (default: 1)
     */
    async evaluate(fen: string, depth: number = 12, multiPV: number = 1): Promise<AnalysisLine[]> {
        return new Promise((resolve, reject) => {
            // variants.ini is in backend root (where package.json is)
            const cwd = path.resolve(process.cwd()) // Assuming process runs from backend root

            // console.log(`🧠 Spawning Stockfish: ${this.stockfishPath} (cwd: ${cwd})`)

            let sf: any
            try {
                sf = spawn(this.stockfishPath, [], { cwd })
            } catch (e) {
                return reject(`Failed to spawn stockfish: ${e}`)
            }

            // Store latest info for each multipv line (1-indexed)
            const lines = new Map<number, AnalysisLine>()

            sf.stdout.on('data', (data: any) => {
                const output = data.toString()
                const logLines = output.split('\n')

                for (const line of logLines) {
                    // Parse "info ... multipv <N> ... score <type> <val> ... pv <moves>"
                    if (line.includes('multipv') && line.includes('score') && line.includes('pv')) {
                        try {
                            const parts = line.split(' ')

                            // Extract MultiPV Index
                            const multipvIndex = parts.indexOf('multipv')
                            const id = parseInt(parts[multipvIndex + 1])

                            // Extract Score
                            const scoreIndex = parts.indexOf('score')
                            const type = parts[scoreIndex + 1] as 'cp' | 'mate'
                            let value = parseInt(parts[scoreIndex + 2])

                            // Invert score if black to move (Stockfish gives white-relative? No, Stockfish gives side-relative usually, but we need absolute? 
                            // Actually Stockfish gives side-to-move relative score. We handle inversion in GameManager usually.
                            // Let's keep it raw here.

                            // Extract PV (moves)
                            const pvIndex = parts.indexOf('pv')
                            const pv = parts.slice(pvIndex + 1).join(' ')

                            lines.set(id, { id, type, value, pv })
                        } catch (e) { }
                    }

                    // Parse bestmove to finish
                    if (line.startsWith('bestmove')) {
                        sf.kill() // Terminate
                        // Return sorted lines (by id usually, 1 is best)
                        const results = Array.from(lines.values()).sort((a, b) => a.id - b.id)

                        // If no lines found (e.g. immediate mate or error), return empty
                        // Or constructs default if single PV was requested but not parsed correctly
                        if (results.length === 0 && multiPV === 1) {
                            // Fallback for simple case (not implemented for safety, assuming parse works)
                            resolve([])
                        } else {
                            resolve(results)
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
            // Use built-in chess variant which supports flexible positions (e.g. rank 1 pawns)
            sf.stdin.write(`setoption name UCI_Variant value chess\n`)
            sf.stdin.write(`setoption name MultiPV value ${multiPV}\n`)
            sf.stdin.write(`isready\n`)
            sf.stdin.write(`position fen ${fen}\n`)
            sf.stdin.write(`go depth ${depth}\n`)
        })
    }
}
