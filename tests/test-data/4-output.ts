// THIS FILE IS AUTOMATICALLY GENERATED BY `generateContractInterfaces.ts`. DO NOT EDIT BY HAND'

export type Primitive = 'uint8' | 'uint64' | 'uint256' | 'bool' | 'string' | 'address' | 'bytes4' | 'bytes20' | 'bytes32' | 'bytes' | 'int256' | 'tuple' | 'address[]' | 'uint8[]' | 'uint256[]' | 'bytes32[]' | 'tuple[]'

export interface AbiParameter {
	name: string
	type: Primitive
	components?: Array<AbiParameter>
}

export interface AbiEventParameter extends AbiParameter {
	indexed: boolean
}

export interface AbiFunction {
	name: string
	type: 'function' | 'constructor' | 'fallback'
	stateMutability: 'pure' | 'view' | 'payable' | 'nonpayable'
	constant: boolean
	payable: boolean
	inputs: Array<AbiParameter>
	outputs: Array<AbiParameter>
}

export interface Transaction<TBigNumber> {
	to: string
	from?: string
	data: string
	value?: TBigNumber
}

export interface RawEvent {
	data: string
	topics: Array<string>
}

export interface TransactionReceipt {
	status: number
	logs: Array<RawEvent>
}

export interface Event {
	name: string
	parameters: unknown
}

export interface EventDescription {
	name: string
	signature: string
	signatureHash: string
	parameters: Array<AbiEventParameter>
}

export const eventDescriptions: { [signatureHash: string]: EventDescription } = {

}


export interface Dependencies<TBigNumber> {
	// TODO: get rid of some of these dependencies in favor of baked in solutions
	keccak256(utf8String: string): string
	encodeParams(abi: AbiFunction, parameters: Array<any>): string
	decodeParams(abi: Array<AbiParameter>, encoded: string): Array<any>
	getDefaultAddress(): Promise<string | undefined>
	call(transaction: Transaction<TBigNumber>): Promise<string>
	submitTransaction(transaction: Transaction<TBigNumber>): Promise<TransactionReceipt>
}


/**
 * By convention, pure/view methods have a `_` suffix on them indicating to the caller that the function will be executed locally and return the function's result.  payable/nonpayable functions have both a local version and a remote version (distinguished by the trailing `_`).  If the remote method is called, you will only get back a transaction hash which can be used to lookup the transaction receipt for success/failure (due to EVM limitations you will not get the function results back).
 */
export class Contract<TBigNumber> {
	protected readonly dependencies: Dependencies<TBigNumber>
	public readonly address: string

	protected constructor(dependencies: Dependencies<TBigNumber>, address: string) {
		this.dependencies = dependencies
		this.address = address
	}

	protected async localCall(abi: AbiFunction, parameters: Array<any>, sender?: string, attachedEth?: TBigNumber): Promise<any> {
		const from = sender || await this.dependencies.getDefaultAddress()
		const data = this.encodeMethod(abi, parameters)
		const transaction = Object.assign({ to: this.address, data: data }, attachedEth ? { value: attachedEth } : {}, from ? { from: from } : {})
		const result = await this.dependencies.call(transaction)
		if (result === '0x') throw new Error(`Call returned '0x' indicating failure.`)
		return this.dependencies.decodeParams(abi.outputs, result)
	}

	protected async remoteCall(abi: AbiFunction, parameters: Array<any>, txName: string, sender?: string, attachedEth?: TBigNumber): Promise<Array<Event>> {
		const from = sender || await this.dependencies.getDefaultAddress()
		const data = this.encodeMethod(abi, parameters)
		const transaction = Object.assign({ to: this.address, data: data }, attachedEth ? { value: attachedEth } : {}, from ? { from: from } : {})
		const transactionReceipt = await this.dependencies.submitTransaction(transaction)
		if (transactionReceipt.status != 1) {
			throw new Error(`Tx ${txName} failed: ${transactionReceipt}`)
		}
		return this.decodeEvents(transactionReceipt.logs)
	}

	private encodeMethod(abi: AbiFunction, parameters: Array<any>): string {
		return `${this.hashSignature(abi)}${this.dependencies.encodeParams(abi, parameters)}`
	}

	private decodeEvents(rawEvents: Array<RawEvent>): Array<Event> {
		const decodedEvents: Array<Event> = []
		rawEvents.forEach(rawEvent => {
			const decodedEvent = this.tryDecodeEvent(rawEvent)
			if (decodedEvent) decodedEvents.push(decodedEvent)
		})
		return decodedEvents
	}

	private tryDecodeEvent(rawEvent: RawEvent): Event | null {
		const signatureHash = rawEvent.topics[0]
		const eventDescription = eventDescriptions[signatureHash]
		if (!eventDescription) return null
		const parameters = this.decodeEventParameters(eventDescription.parameters, rawEvent.topics, rawEvent.data, { eventSignature: eventDescription.signature })
		return { name: eventDescription.name, parameters: parameters }
	}

	private hashSignature(abiFunction: AbiFunction): string {
		const parameters = this.stringifyParams(abiFunction.inputs).join(',')
		const signature = `${abiFunction.name}(${parameters})`
		return this.dependencies.keccak256(signature).substring(0, 10)
	}

	private stringifyParams(params: Array<AbiParameter>): Array<string> {
		return params.map(param => {
			if (param.type === 'tuple') {
				if (!param.components) throw new Error(`Expected components when type is ${param.type}`)
				return `(${this.stringifyParams(param.components).join(',')})`
			} else if (param.type === 'tuple[]') {
				if (!param.components) throw new Error(`Expected components when type is ${param.type}`)
				return `(${this.stringifyParams(param.components).join(',')})[]`
			} else {
				return param.type
			}
		})
	}

	private decodeEventParameters(parameters: Array<AbiEventParameter>, topics: Array<string>, data: string, errorContext: { eventSignature: string }): any {
		const indexedTypesForDecoding = parameters.filter(parameter => parameter.indexed).map(this.getTypeForEventDecoding)
		const nonIndexedTypesForDecoding = parameters.filter(parameter => !parameter.indexed)
		const indexedData = `0x${topics.slice(1).map(topic => topic.substring(2)).join('')}`
		const nonIndexedData = data
		// TODO: roll own parameter decoder instead of using dependency
		const decodedIndexedParameters = this.dependencies.decodeParams(indexedTypesForDecoding, indexedData)
		if (!decodedIndexedParameters) throw new Error(`Failed to decode topics for event ${errorContext.eventSignature}.\n${indexedData}`)
		const decodedNonIndexedParameters = this.dependencies.decodeParams(nonIndexedTypesForDecoding, nonIndexedData)
		if (!decodedNonIndexedParameters) throw new Error(`Failed to decode data for event ${errorContext.eventSignature}.\n${nonIndexedData}`)
		const result: { [name: string]: any } = {}
		indexedTypesForDecoding.forEach((parameter, i) => result[parameter.name] = decodedIndexedParameters[i])
		nonIndexedTypesForDecoding.forEach((parameter, i) => result[parameter.name] = decodedNonIndexedParameters[i])
		return result
	}

	private getTypeForEventDecoding(parameter: AbiEventParameter): AbiEventParameter {
		if (!parameter.indexed) return parameter
		if (parameter.type !== 'string'
			&& parameter.type !== 'bytes'
			&& !parameter.type.startsWith('tuple')
			&& !parameter.type.endsWith('[]'))
			return parameter
		return Object.assign({}, parameter, { type: 'bytes32' })
	}
}


export class banana<TBigNumber> extends Contract<TBigNumber> {
	public constructor(dependencies: Dependencies<TBigNumber>, address: string) {
		super(dependencies, address)
	}

	public cherry = async (durian: TBigNumber, options?: { sender?: string, attachedEth?: TBigNumber }): Promise<Array<Event>> => {
		options = options || {}
		const abi: AbiFunction = {"name":"cherry","type":"function","constant":false,"payable":true,"stateMutability":"payable","inputs":[{"name":"durian","type":"uint256"}],"outputs":[{"name":"eggplant","type":"bool"}]}
		return await this.remoteCall(abi, [durian], 'cherry', options.sender, options.attachedEth)
	}

	public cherry_ = async (durian: TBigNumber, options?: { sender?: string, attachedEth?: TBigNumber }): Promise<boolean> => {
		options = options || {}
		const abi: AbiFunction = {"name":"cherry","type":"function","constant":false,"payable":true,"stateMutability":"payable","inputs":[{"name":"durian","type":"uint256"}],"outputs":[{"name":"eggplant","type":"bool"}]}
		const result = await this.localCall(abi, [durian], options.sender, options.attachedEth)
		return <boolean>result[0]
	}
}

