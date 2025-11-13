import { Cell, Slice, Address, Builder, TupleItem, TupleReader, Dictionary, ContractProvider, Sender, Contract, ContractABI, DictionaryValue } from '@ton/core';
export type DataSize = {
    $$type: 'DataSize';
    cells: bigint;
    bits: bigint;
    refs: bigint;
};
export declare function storeDataSize(src: DataSize): (builder: Builder) => void;
export declare function loadDataSize(slice: Slice): {
    $$type: "DataSize";
    cells: bigint;
    bits: bigint;
    refs: bigint;
};
export declare function loadTupleDataSize(source: TupleReader): {
    $$type: "DataSize";
    cells: bigint;
    bits: bigint;
    refs: bigint;
};
export declare function loadGetterTupleDataSize(source: TupleReader): {
    $$type: "DataSize";
    cells: bigint;
    bits: bigint;
    refs: bigint;
};
export declare function storeTupleDataSize(source: DataSize): TupleItem[];
export declare function dictValueParserDataSize(): DictionaryValue<DataSize>;
export type SignedBundle = {
    $$type: 'SignedBundle';
    signature: Buffer;
    signedData: Slice;
};
export declare function storeSignedBundle(src: SignedBundle): (builder: Builder) => void;
export declare function loadSignedBundle(slice: Slice): {
    $$type: "SignedBundle";
    signature: Buffer<ArrayBufferLike>;
    signedData: Slice;
};
export declare function loadTupleSignedBundle(source: TupleReader): {
    $$type: "SignedBundle";
    signature: Buffer<ArrayBufferLike>;
    signedData: Slice;
};
export declare function loadGetterTupleSignedBundle(source: TupleReader): {
    $$type: "SignedBundle";
    signature: Buffer<ArrayBufferLike>;
    signedData: Slice;
};
export declare function storeTupleSignedBundle(source: SignedBundle): TupleItem[];
export declare function dictValueParserSignedBundle(): DictionaryValue<SignedBundle>;
export type StateInit = {
    $$type: 'StateInit';
    code: Cell;
    data: Cell;
};
export declare function storeStateInit(src: StateInit): (builder: Builder) => void;
export declare function loadStateInit(slice: Slice): {
    $$type: "StateInit";
    code: Cell;
    data: Cell;
};
export declare function loadTupleStateInit(source: TupleReader): {
    $$type: "StateInit";
    code: Cell;
    data: Cell;
};
export declare function loadGetterTupleStateInit(source: TupleReader): {
    $$type: "StateInit";
    code: Cell;
    data: Cell;
};
export declare function storeTupleStateInit(source: StateInit): TupleItem[];
export declare function dictValueParserStateInit(): DictionaryValue<StateInit>;
export type Context = {
    $$type: 'Context';
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
};
export declare function storeContext(src: Context): (builder: Builder) => void;
export declare function loadContext(slice: Slice): {
    $$type: "Context";
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
};
export declare function loadTupleContext(source: TupleReader): {
    $$type: "Context";
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
};
export declare function loadGetterTupleContext(source: TupleReader): {
    $$type: "Context";
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
};
export declare function storeTupleContext(source: Context): TupleItem[];
export declare function dictValueParserContext(): DictionaryValue<Context>;
export type SendParameters = {
    $$type: 'SendParameters';
    mode: bigint;
    body: Cell | null;
    code: Cell | null;
    data: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
};
export declare function storeSendParameters(src: SendParameters): (builder: Builder) => void;
export declare function loadSendParameters(slice: Slice): {
    $$type: "SendParameters";
    mode: bigint;
    body: Cell;
    code: Cell;
    data: Cell;
    value: bigint;
    to: Address;
    bounce: boolean;
};
export declare function loadTupleSendParameters(source: TupleReader): {
    $$type: "SendParameters";
    mode: bigint;
    body: Cell;
    code: Cell;
    data: Cell;
    value: bigint;
    to: Address;
    bounce: boolean;
};
export declare function loadGetterTupleSendParameters(source: TupleReader): {
    $$type: "SendParameters";
    mode: bigint;
    body: Cell;
    code: Cell;
    data: Cell;
    value: bigint;
    to: Address;
    bounce: boolean;
};
export declare function storeTupleSendParameters(source: SendParameters): TupleItem[];
export declare function dictValueParserSendParameters(): DictionaryValue<SendParameters>;
export type MessageParameters = {
    $$type: 'MessageParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
};
export declare function storeMessageParameters(src: MessageParameters): (builder: Builder) => void;
export declare function loadMessageParameters(slice: Slice): {
    $$type: "MessageParameters";
    mode: bigint;
    body: Cell;
    value: bigint;
    to: Address;
    bounce: boolean;
};
export declare function loadTupleMessageParameters(source: TupleReader): {
    $$type: "MessageParameters";
    mode: bigint;
    body: Cell;
    value: bigint;
    to: Address;
    bounce: boolean;
};
export declare function loadGetterTupleMessageParameters(source: TupleReader): {
    $$type: "MessageParameters";
    mode: bigint;
    body: Cell;
    value: bigint;
    to: Address;
    bounce: boolean;
};
export declare function storeTupleMessageParameters(source: MessageParameters): TupleItem[];
export declare function dictValueParserMessageParameters(): DictionaryValue<MessageParameters>;
export type DeployParameters = {
    $$type: 'DeployParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    bounce: boolean;
    init: StateInit;
};
export declare function storeDeployParameters(src: DeployParameters): (builder: Builder) => void;
export declare function loadDeployParameters(slice: Slice): {
    $$type: "DeployParameters";
    mode: bigint;
    body: Cell;
    value: bigint;
    bounce: boolean;
    init: {
        $$type: "StateInit";
        code: Cell;
        data: Cell;
    };
};
export declare function loadTupleDeployParameters(source: TupleReader): {
    $$type: "DeployParameters";
    mode: bigint;
    body: Cell;
    value: bigint;
    bounce: boolean;
    init: {
        $$type: "StateInit";
        code: Cell;
        data: Cell;
    };
};
export declare function loadGetterTupleDeployParameters(source: TupleReader): {
    $$type: "DeployParameters";
    mode: bigint;
    body: Cell;
    value: bigint;
    bounce: boolean;
    init: {
        $$type: "StateInit";
        code: Cell;
        data: Cell;
    };
};
export declare function storeTupleDeployParameters(source: DeployParameters): TupleItem[];
export declare function dictValueParserDeployParameters(): DictionaryValue<DeployParameters>;
export type StdAddress = {
    $$type: 'StdAddress';
    workchain: bigint;
    address: bigint;
};
export declare function storeStdAddress(src: StdAddress): (builder: Builder) => void;
export declare function loadStdAddress(slice: Slice): {
    $$type: "StdAddress";
    workchain: bigint;
    address: bigint;
};
export declare function loadTupleStdAddress(source: TupleReader): {
    $$type: "StdAddress";
    workchain: bigint;
    address: bigint;
};
export declare function loadGetterTupleStdAddress(source: TupleReader): {
    $$type: "StdAddress";
    workchain: bigint;
    address: bigint;
};
export declare function storeTupleStdAddress(source: StdAddress): TupleItem[];
export declare function dictValueParserStdAddress(): DictionaryValue<StdAddress>;
export type VarAddress = {
    $$type: 'VarAddress';
    workchain: bigint;
    address: Slice;
};
export declare function storeVarAddress(src: VarAddress): (builder: Builder) => void;
export declare function loadVarAddress(slice: Slice): {
    $$type: "VarAddress";
    workchain: bigint;
    address: Slice;
};
export declare function loadTupleVarAddress(source: TupleReader): {
    $$type: "VarAddress";
    workchain: bigint;
    address: Slice;
};
export declare function loadGetterTupleVarAddress(source: TupleReader): {
    $$type: "VarAddress";
    workchain: bigint;
    address: Slice;
};
export declare function storeTupleVarAddress(source: VarAddress): TupleItem[];
export declare function dictValueParserVarAddress(): DictionaryValue<VarAddress>;
export type BasechainAddress = {
    $$type: 'BasechainAddress';
    hash: bigint | null;
};
export declare function storeBasechainAddress(src: BasechainAddress): (builder: Builder) => void;
export declare function loadBasechainAddress(slice: Slice): {
    $$type: "BasechainAddress";
    hash: bigint;
};
export declare function loadTupleBasechainAddress(source: TupleReader): {
    $$type: "BasechainAddress";
    hash: bigint;
};
export declare function loadGetterTupleBasechainAddress(source: TupleReader): {
    $$type: "BasechainAddress";
    hash: bigint;
};
export declare function storeTupleBasechainAddress(source: BasechainAddress): TupleItem[];
export declare function dictValueParserBasechainAddress(): DictionaryValue<BasechainAddress>;
export type Deploy = {
    $$type: 'Deploy';
    queryId: bigint;
};
export declare function storeDeploy(src: Deploy): (builder: Builder) => void;
export declare function loadDeploy(slice: Slice): {
    $$type: "Deploy";
    queryId: bigint;
};
export declare function loadTupleDeploy(source: TupleReader): {
    $$type: "Deploy";
    queryId: bigint;
};
export declare function loadGetterTupleDeploy(source: TupleReader): {
    $$type: "Deploy";
    queryId: bigint;
};
export declare function storeTupleDeploy(source: Deploy): TupleItem[];
export declare function dictValueParserDeploy(): DictionaryValue<Deploy>;
export type DeployOk = {
    $$type: 'DeployOk';
    queryId: bigint;
};
export declare function storeDeployOk(src: DeployOk): (builder: Builder) => void;
export declare function loadDeployOk(slice: Slice): {
    $$type: "DeployOk";
    queryId: bigint;
};
export declare function loadTupleDeployOk(source: TupleReader): {
    $$type: "DeployOk";
    queryId: bigint;
};
export declare function loadGetterTupleDeployOk(source: TupleReader): {
    $$type: "DeployOk";
    queryId: bigint;
};
export declare function storeTupleDeployOk(source: DeployOk): TupleItem[];
export declare function dictValueParserDeployOk(): DictionaryValue<DeployOk>;
export type FactoryDeploy = {
    $$type: 'FactoryDeploy';
    queryId: bigint;
    cashback: Address;
};
export declare function storeFactoryDeploy(src: FactoryDeploy): (builder: Builder) => void;
export declare function loadFactoryDeploy(slice: Slice): {
    $$type: "FactoryDeploy";
    queryId: bigint;
    cashback: Address;
};
export declare function loadTupleFactoryDeploy(source: TupleReader): {
    $$type: "FactoryDeploy";
    queryId: bigint;
    cashback: Address;
};
export declare function loadGetterTupleFactoryDeploy(source: TupleReader): {
    $$type: "FactoryDeploy";
    queryId: bigint;
    cashback: Address;
};
export declare function storeTupleFactoryDeploy(source: FactoryDeploy): TupleItem[];
export declare function dictValueParserFactoryDeploy(): DictionaryValue<FactoryDeploy>;
export type CreateValuation = {
    $$type: 'CreateValuation';
    query_id: bigint;
    user: Cell;
    store: Cell;
    valuationHash: Cell;
};
export declare function storeCreateValuation(src: CreateValuation): (builder: Builder) => void;
export declare function loadCreateValuation(slice: Slice): {
    $$type: "CreateValuation";
    query_id: bigint;
    user: Cell;
    store: Cell;
    valuationHash: Cell;
};
export declare function loadTupleCreateValuation(source: TupleReader): {
    $$type: "CreateValuation";
    query_id: bigint;
    user: Cell;
    store: Cell;
    valuationHash: Cell;
};
export declare function loadGetterTupleCreateValuation(source: TupleReader): {
    $$type: "CreateValuation";
    query_id: bigint;
    user: Cell;
    store: Cell;
    valuationHash: Cell;
};
export declare function storeTupleCreateValuation(source: CreateValuation): TupleItem[];
export declare function dictValueParserCreateValuation(): DictionaryValue<CreateValuation>;
export type SetValuationStatus = {
    $$type: 'SetValuationStatus';
    query_id: bigint;
    id: bigint;
    status: bigint;
};
export declare function storeSetValuationStatus(src: SetValuationStatus): (builder: Builder) => void;
export declare function loadSetValuationStatus(slice: Slice): {
    $$type: "SetValuationStatus";
    query_id: bigint;
    id: bigint;
    status: bigint;
};
export declare function loadTupleSetValuationStatus(source: TupleReader): {
    $$type: "SetValuationStatus";
    query_id: bigint;
    id: bigint;
    status: bigint;
};
export declare function loadGetterTupleSetValuationStatus(source: TupleReader): {
    $$type: "SetValuationStatus";
    query_id: bigint;
    id: bigint;
    status: bigint;
};
export declare function storeTupleSetValuationStatus(source: SetValuationStatus): TupleItem[];
export declare function dictValueParserSetValuationStatus(): DictionaryValue<SetValuationStatus>;
export type Valuation = {
    $$type: 'Valuation';
    user: Cell;
    store: Cell;
    valuationHash: Cell;
    status: bigint;
    timestamp: bigint;
};
export declare function storeValuation(src: Valuation): (builder: Builder) => void;
export declare function loadValuation(slice: Slice): {
    $$type: "Valuation";
    user: Cell;
    store: Cell;
    valuationHash: Cell;
    status: bigint;
    timestamp: bigint;
};
export declare function loadTupleValuation(source: TupleReader): {
    $$type: "Valuation";
    user: Cell;
    store: Cell;
    valuationHash: Cell;
    status: bigint;
    timestamp: bigint;
};
export declare function loadGetterTupleValuation(source: TupleReader): {
    $$type: "Valuation";
    user: Cell;
    store: Cell;
    valuationHash: Cell;
    status: bigint;
    timestamp: bigint;
};
export declare function storeTupleValuation(source: Valuation): TupleItem[];
export declare function dictValueParserValuation(): DictionaryValue<Valuation>;
export type DhahabyValuation$Data = {
    $$type: 'DhahabyValuation$Data';
    owner: Address;
    nextId: bigint;
    vals: Dictionary<number, Valuation>;
};
export declare function storeDhahabyValuation$Data(src: DhahabyValuation$Data): (builder: Builder) => void;
export declare function loadDhahabyValuation$Data(slice: Slice): {
    $$type: "DhahabyValuation$Data";
    owner: Address;
    nextId: bigint;
    vals: Dictionary<number, Valuation>;
};
export declare function loadTupleDhahabyValuation$Data(source: TupleReader): {
    $$type: "DhahabyValuation$Data";
    owner: Address;
    nextId: bigint;
    vals: Dictionary<number, Valuation>;
};
export declare function loadGetterTupleDhahabyValuation$Data(source: TupleReader): {
    $$type: "DhahabyValuation$Data";
    owner: Address;
    nextId: bigint;
    vals: Dictionary<number, Valuation>;
};
export declare function storeTupleDhahabyValuation$Data(source: DhahabyValuation$Data): TupleItem[];
export declare function dictValueParserDhahabyValuation$Data(): DictionaryValue<DhahabyValuation$Data>;
export declare const DhahabyValuation_errors: {
    readonly 2: {
        readonly message: "Stack underflow";
    };
    readonly 3: {
        readonly message: "Stack overflow";
    };
    readonly 4: {
        readonly message: "Integer overflow";
    };
    readonly 5: {
        readonly message: "Integer out of expected range";
    };
    readonly 6: {
        readonly message: "Invalid opcode";
    };
    readonly 7: {
        readonly message: "Type check error";
    };
    readonly 8: {
        readonly message: "Cell overflow";
    };
    readonly 9: {
        readonly message: "Cell underflow";
    };
    readonly 10: {
        readonly message: "Dictionary error";
    };
    readonly 11: {
        readonly message: "'Unknown' error";
    };
    readonly 12: {
        readonly message: "Fatal error";
    };
    readonly 13: {
        readonly message: "Out of gas error";
    };
    readonly 14: {
        readonly message: "Virtualization error";
    };
    readonly 32: {
        readonly message: "Action list is invalid";
    };
    readonly 33: {
        readonly message: "Action list is too long";
    };
    readonly 34: {
        readonly message: "Action is invalid or not supported";
    };
    readonly 35: {
        readonly message: "Invalid source address in outbound message";
    };
    readonly 36: {
        readonly message: "Invalid destination address in outbound message";
    };
    readonly 37: {
        readonly message: "Not enough Toncoin";
    };
    readonly 38: {
        readonly message: "Not enough extra currencies";
    };
    readonly 39: {
        readonly message: "Outbound message does not fit into a cell after rewriting";
    };
    readonly 40: {
        readonly message: "Cannot process a message";
    };
    readonly 41: {
        readonly message: "Library reference is null";
    };
    readonly 42: {
        readonly message: "Library change action error";
    };
    readonly 43: {
        readonly message: "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree";
    };
    readonly 50: {
        readonly message: "Account state size exceeded limits";
    };
    readonly 128: {
        readonly message: "Null reference exception";
    };
    readonly 129: {
        readonly message: "Invalid serialization prefix";
    };
    readonly 130: {
        readonly message: "Invalid incoming message";
    };
    readonly 131: {
        readonly message: "Constraints error";
    };
    readonly 132: {
        readonly message: "Access denied";
    };
    readonly 133: {
        readonly message: "Contract stopped";
    };
    readonly 134: {
        readonly message: "Invalid argument";
    };
    readonly 135: {
        readonly message: "Code of a contract was not found";
    };
    readonly 136: {
        readonly message: "Invalid standard address";
    };
    readonly 138: {
        readonly message: "Not a basechain address";
    };
    readonly 5070: {
        readonly message: "Invalid status: Must be 1 (approved) or 2 (rejected).";
    };
    readonly 20164: {
        readonly message: "Unauthorized: Only owner can set status.";
    };
    readonly 33411: {
        readonly message: "Unauthorized: Only owner can create valuation.";
    };
    readonly 42829: {
        readonly message: "Valuation ID not found.";
    };
};
export declare const DhahabyValuation_errors_backward: {
    readonly "Stack underflow": 2;
    readonly "Stack overflow": 3;
    readonly "Integer overflow": 4;
    readonly "Integer out of expected range": 5;
    readonly "Invalid opcode": 6;
    readonly "Type check error": 7;
    readonly "Cell overflow": 8;
    readonly "Cell underflow": 9;
    readonly "Dictionary error": 10;
    readonly "'Unknown' error": 11;
    readonly "Fatal error": 12;
    readonly "Out of gas error": 13;
    readonly "Virtualization error": 14;
    readonly "Action list is invalid": 32;
    readonly "Action list is too long": 33;
    readonly "Action is invalid or not supported": 34;
    readonly "Invalid source address in outbound message": 35;
    readonly "Invalid destination address in outbound message": 36;
    readonly "Not enough Toncoin": 37;
    readonly "Not enough extra currencies": 38;
    readonly "Outbound message does not fit into a cell after rewriting": 39;
    readonly "Cannot process a message": 40;
    readonly "Library reference is null": 41;
    readonly "Library change action error": 42;
    readonly "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43;
    readonly "Account state size exceeded limits": 50;
    readonly "Null reference exception": 128;
    readonly "Invalid serialization prefix": 129;
    readonly "Invalid incoming message": 130;
    readonly "Constraints error": 131;
    readonly "Access denied": 132;
    readonly "Contract stopped": 133;
    readonly "Invalid argument": 134;
    readonly "Code of a contract was not found": 135;
    readonly "Invalid standard address": 136;
    readonly "Not a basechain address": 138;
    readonly "Invalid status: Must be 1 (approved) or 2 (rejected).": 5070;
    readonly "Unauthorized: Only owner can set status.": 20164;
    readonly "Unauthorized: Only owner can create valuation.": 33411;
    readonly "Valuation ID not found.": 42829;
};
export declare const DhahabyValuation_getterMapping: {
    [key: string]: string;
};
export declare class DhahabyValuation implements Contract {
    static readonly storageReserve = 0n;
    static readonly errors: {
        readonly "Stack underflow": 2;
        readonly "Stack overflow": 3;
        readonly "Integer overflow": 4;
        readonly "Integer out of expected range": 5;
        readonly "Invalid opcode": 6;
        readonly "Type check error": 7;
        readonly "Cell overflow": 8;
        readonly "Cell underflow": 9;
        readonly "Dictionary error": 10;
        readonly "'Unknown' error": 11;
        readonly "Fatal error": 12;
        readonly "Out of gas error": 13;
        readonly "Virtualization error": 14;
        readonly "Action list is invalid": 32;
        readonly "Action list is too long": 33;
        readonly "Action is invalid or not supported": 34;
        readonly "Invalid source address in outbound message": 35;
        readonly "Invalid destination address in outbound message": 36;
        readonly "Not enough Toncoin": 37;
        readonly "Not enough extra currencies": 38;
        readonly "Outbound message does not fit into a cell after rewriting": 39;
        readonly "Cannot process a message": 40;
        readonly "Library reference is null": 41;
        readonly "Library change action error": 42;
        readonly "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43;
        readonly "Account state size exceeded limits": 50;
        readonly "Null reference exception": 128;
        readonly "Invalid serialization prefix": 129;
        readonly "Invalid incoming message": 130;
        readonly "Constraints error": 131;
        readonly "Access denied": 132;
        readonly "Contract stopped": 133;
        readonly "Invalid argument": 134;
        readonly "Code of a contract was not found": 135;
        readonly "Invalid standard address": 136;
        readonly "Not a basechain address": 138;
        readonly "Invalid status: Must be 1 (approved) or 2 (rejected).": 5070;
        readonly "Unauthorized: Only owner can set status.": 20164;
        readonly "Unauthorized: Only owner can create valuation.": 33411;
        readonly "Valuation ID not found.": 42829;
    };
    static readonly opcodes: {
        Deploy: number;
        DeployOk: number;
        FactoryDeploy: number;
        CreateValuation: number;
        SetValuationStatus: number;
    };
    static init(): Promise<{
        code: Cell;
        data: Cell;
    }>;
    static fromInit(): Promise<DhahabyValuation>;
    static fromAddress(address: Address): DhahabyValuation;
    readonly address: Address;
    readonly init?: {
        code: Cell;
        data: Cell;
    };
    readonly abi: ContractABI;
    constructor(address: Address, init?: {
        code: Cell;
        data: Cell;
    });
    send(provider: ContractProvider, via: Sender, args: {
        value: bigint;
        bounce?: boolean | null | undefined;
    }, message: CreateValuation | SetValuationStatus | Deploy): Promise<void>;
    getGetValuation(provider: ContractProvider, id: bigint): Promise<{
        $$type: "Valuation";
        user: Cell;
        store: Cell;
        valuationHash: Cell;
        status: bigint;
        timestamp: bigint;
    }>;
    getGetNextId(provider: ContractProvider): Promise<bigint>;
    getGetOwner(provider: ContractProvider): Promise<Address>;
}
