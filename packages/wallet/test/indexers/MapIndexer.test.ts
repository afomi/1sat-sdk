import { describe, expect, it } from 'bun:test'
import { B_PREFIX, MAP_PREFIX } from '@1sat/templates'
import type { Txo } from '@1sat/types'
import { type LockingScript, OP, Script, Utils } from '@bsv/sdk'
import { MapIndexer } from '../../src/indexers/MapIndexer'
import { Outpoint } from '../../src/indexers/Outpoint'

const AIP_PREFIX = '15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva'

// OP_FALSE OP_RETURN <pushes...>, with "|" separating Bitcom protocols.
function opReturn(...pushes: string[]): Script {
	const script = new Script()
	script.writeOpCode(OP.OP_FALSE).writeOpCode(OP.OP_RETURN)
	for (const push of pushes) script.writeBin(Utils.toArray(push, 'utf8'))
	// Parse from bytes, as an output read from a transaction is.
	return Script.fromHex(script.toHex())
}

const makeTxo = (lockingScript: Script): Txo => ({
	output: { satoshis: 0, lockingScript: lockingScript as LockingScript },
	outpoint: new Outpoint('aa'.repeat(32), 0),
	data: {},
})

const parse = (script: Script) => new MapIndexer().parse(makeTxo(script))

describe('MapIndexer', () => {
	it('reads MAP SET as the first protocol', async () => {
		const result = await parse(
			opReturn(MAP_PREFIX, 'SET', 'app', 'example', 'type', 'post'),
		)
		expect(result?.data).toEqual({ app: 'example', type: 'post' })
	})

	it('finds MAP after another protocol (B | MAP)', async () => {
		const result = await parse(
			opReturn(
				B_PREFIX,
				'hello',
				'text/plain',
				'utf-8',
				'|',
				MAP_PREFIX,
				'SET',
				'app',
				'example',
				'type',
				'post',
			),
		)
		expect(result?.data).toEqual({ app: 'example', type: 'post' })
	})

	it('stops reading MAP pairs at the next protocol (MAP | AIP)', async () => {
		const result = await parse(
			opReturn(
				MAP_PREFIX,
				'SET',
				'app',
				'example',
				'type',
				'post',
				'|',
				AIP_PREFIX,
				'BITCOIN_ECDSA',
				'1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
				'signature',
			),
		)
		expect(result?.data).toEqual({ app: 'example', type: 'post' })
	})

	it('keeps single-character keys and values inside MAP', async () => {
		const result = await parse(
			opReturn(MAP_PREFIX, 'SET', 'app', 'example', 'v', '1'),
		)
		expect(result?.data).toEqual({ app: 'example', v: '1' })
	})
})
