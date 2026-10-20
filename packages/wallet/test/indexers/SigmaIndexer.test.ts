import { describe, expect, it } from 'bun:test'
import { MAP_PREFIX } from '@1sat/templates'
import type { Txo } from '@1sat/types'
import { type LockingScript, OP, Script, Utils } from '@bsv/sdk'
import { Outpoint } from '../../src/indexers/Outpoint'
import { SigmaIndexer } from '../../src/indexers/SigmaIndexer'

const address = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH'
const signature = Array.from({ length: 65 }, (_, i) => i)

function opReturn(...pushes: (string | number[])[]): Script {
	const script = new Script()
	script.writeOpCode(OP.OP_FALSE).writeOpCode(OP.OP_RETURN)
	for (const push of pushes)
		script.writeBin(
			typeof push === 'string' ? Utils.toArray(push, 'utf8') : push,
		)
	// Parse from bytes, as an output read from a transaction is.
	return Script.fromHex(script.toHex())
}

const makeTxo = (lockingScript: Script, vout = 0): Txo => ({
	output: { satoshis: 0, lockingScript: lockingScript as LockingScript },
	outpoint: new Outpoint('aa'.repeat(32), vout),
	data: {},
})

describe('SigmaIndexer', () => {
	it('reads a SIGMA signature after MAP in a plain OP_RETURN output', async () => {
		const script = opReturn(
			MAP_PREFIX,
			'SET',
			'app',
			'example',
			'|',
			'SIGMA',
			'BSM',
			address,
			signature,
			'0',
		)

		const result = await new SigmaIndexer().parse(makeTxo(script))

		expect(result?.data).toEqual([
			{ algorithm: 'BSM', address, signature, vin: 0, valid: false },
		])
	})

	it('defaults vin to the output index when it is missing', async () => {
		const script = opReturn('|', 'SIGMA', 'BSM', address, signature)

		const result = await new SigmaIndexer().parse(makeTxo(script, 3))

		expect((result?.data as { vin: number }[])[0].vin).toBe(3)
	})

	it('ignores an OP_RETURN output with no SIGMA protocol', async () => {
		const script = opReturn(MAP_PREFIX, 'SET', 'app', 'example')

		expect(await new SigmaIndexer().parse(makeTxo(script))).toBeUndefined()
	})
})
