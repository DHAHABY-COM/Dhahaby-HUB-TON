"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DhahabyValuation = exports.DhahabyValuation_getterMapping = exports.DhahabyValuation_errors_backward = exports.DhahabyValuation_errors = void 0;
exports.storeDataSize = storeDataSize;
exports.loadDataSize = loadDataSize;
exports.loadTupleDataSize = loadTupleDataSize;
exports.loadGetterTupleDataSize = loadGetterTupleDataSize;
exports.storeTupleDataSize = storeTupleDataSize;
exports.dictValueParserDataSize = dictValueParserDataSize;
exports.storeSignedBundle = storeSignedBundle;
exports.loadSignedBundle = loadSignedBundle;
exports.loadTupleSignedBundle = loadTupleSignedBundle;
exports.loadGetterTupleSignedBundle = loadGetterTupleSignedBundle;
exports.storeTupleSignedBundle = storeTupleSignedBundle;
exports.dictValueParserSignedBundle = dictValueParserSignedBundle;
exports.storeStateInit = storeStateInit;
exports.loadStateInit = loadStateInit;
exports.loadTupleStateInit = loadTupleStateInit;
exports.loadGetterTupleStateInit = loadGetterTupleStateInit;
exports.storeTupleStateInit = storeTupleStateInit;
exports.dictValueParserStateInit = dictValueParserStateInit;
exports.storeContext = storeContext;
exports.loadContext = loadContext;
exports.loadTupleContext = loadTupleContext;
exports.loadGetterTupleContext = loadGetterTupleContext;
exports.storeTupleContext = storeTupleContext;
exports.dictValueParserContext = dictValueParserContext;
exports.storeSendParameters = storeSendParameters;
exports.loadSendParameters = loadSendParameters;
exports.loadTupleSendParameters = loadTupleSendParameters;
exports.loadGetterTupleSendParameters = loadGetterTupleSendParameters;
exports.storeTupleSendParameters = storeTupleSendParameters;
exports.dictValueParserSendParameters = dictValueParserSendParameters;
exports.storeMessageParameters = storeMessageParameters;
exports.loadMessageParameters = loadMessageParameters;
exports.loadTupleMessageParameters = loadTupleMessageParameters;
exports.loadGetterTupleMessageParameters = loadGetterTupleMessageParameters;
exports.storeTupleMessageParameters = storeTupleMessageParameters;
exports.dictValueParserMessageParameters = dictValueParserMessageParameters;
exports.storeDeployParameters = storeDeployParameters;
exports.loadDeployParameters = loadDeployParameters;
exports.loadTupleDeployParameters = loadTupleDeployParameters;
exports.loadGetterTupleDeployParameters = loadGetterTupleDeployParameters;
exports.storeTupleDeployParameters = storeTupleDeployParameters;
exports.dictValueParserDeployParameters = dictValueParserDeployParameters;
exports.storeStdAddress = storeStdAddress;
exports.loadStdAddress = loadStdAddress;
exports.loadTupleStdAddress = loadTupleStdAddress;
exports.loadGetterTupleStdAddress = loadGetterTupleStdAddress;
exports.storeTupleStdAddress = storeTupleStdAddress;
exports.dictValueParserStdAddress = dictValueParserStdAddress;
exports.storeVarAddress = storeVarAddress;
exports.loadVarAddress = loadVarAddress;
exports.loadTupleVarAddress = loadTupleVarAddress;
exports.loadGetterTupleVarAddress = loadGetterTupleVarAddress;
exports.storeTupleVarAddress = storeTupleVarAddress;
exports.dictValueParserVarAddress = dictValueParserVarAddress;
exports.storeBasechainAddress = storeBasechainAddress;
exports.loadBasechainAddress = loadBasechainAddress;
exports.loadTupleBasechainAddress = loadTupleBasechainAddress;
exports.loadGetterTupleBasechainAddress = loadGetterTupleBasechainAddress;
exports.storeTupleBasechainAddress = storeTupleBasechainAddress;
exports.dictValueParserBasechainAddress = dictValueParserBasechainAddress;
exports.storeDeploy = storeDeploy;
exports.loadDeploy = loadDeploy;
exports.loadTupleDeploy = loadTupleDeploy;
exports.loadGetterTupleDeploy = loadGetterTupleDeploy;
exports.storeTupleDeploy = storeTupleDeploy;
exports.dictValueParserDeploy = dictValueParserDeploy;
exports.storeDeployOk = storeDeployOk;
exports.loadDeployOk = loadDeployOk;
exports.loadTupleDeployOk = loadTupleDeployOk;
exports.loadGetterTupleDeployOk = loadGetterTupleDeployOk;
exports.storeTupleDeployOk = storeTupleDeployOk;
exports.dictValueParserDeployOk = dictValueParserDeployOk;
exports.storeFactoryDeploy = storeFactoryDeploy;
exports.loadFactoryDeploy = loadFactoryDeploy;
exports.loadTupleFactoryDeploy = loadTupleFactoryDeploy;
exports.loadGetterTupleFactoryDeploy = loadGetterTupleFactoryDeploy;
exports.storeTupleFactoryDeploy = storeTupleFactoryDeploy;
exports.dictValueParserFactoryDeploy = dictValueParserFactoryDeploy;
exports.storeCreateValuation = storeCreateValuation;
exports.loadCreateValuation = loadCreateValuation;
exports.loadTupleCreateValuation = loadTupleCreateValuation;
exports.loadGetterTupleCreateValuation = loadGetterTupleCreateValuation;
exports.storeTupleCreateValuation = storeTupleCreateValuation;
exports.dictValueParserCreateValuation = dictValueParserCreateValuation;
exports.storeSetValuationStatus = storeSetValuationStatus;
exports.loadSetValuationStatus = loadSetValuationStatus;
exports.loadTupleSetValuationStatus = loadTupleSetValuationStatus;
exports.loadGetterTupleSetValuationStatus = loadGetterTupleSetValuationStatus;
exports.storeTupleSetValuationStatus = storeTupleSetValuationStatus;
exports.dictValueParserSetValuationStatus = dictValueParserSetValuationStatus;
exports.storeValuation = storeValuation;
exports.loadValuation = loadValuation;
exports.loadTupleValuation = loadTupleValuation;
exports.loadGetterTupleValuation = loadGetterTupleValuation;
exports.storeTupleValuation = storeTupleValuation;
exports.dictValueParserValuation = dictValueParserValuation;
exports.storeDhahabyValuation$Data = storeDhahabyValuation$Data;
exports.loadDhahabyValuation$Data = loadDhahabyValuation$Data;
exports.loadTupleDhahabyValuation$Data = loadTupleDhahabyValuation$Data;
exports.loadGetterTupleDhahabyValuation$Data = loadGetterTupleDhahabyValuation$Data;
exports.storeTupleDhahabyValuation$Data = storeTupleDhahabyValuation$Data;
exports.dictValueParserDhahabyValuation$Data = dictValueParserDhahabyValuation$Data;
const core_1 = require("@ton/core");
function storeDataSize(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeInt(src.cells, 257);
        b_0.storeInt(src.bits, 257);
        b_0.storeInt(src.refs, 257);
    };
}
function loadDataSize(slice) {
    const sc_0 = slice;
    const _cells = sc_0.loadIntBig(257);
    const _bits = sc_0.loadIntBig(257);
    const _refs = sc_0.loadIntBig(257);
    return { $$type: 'DataSize', cells: _cells, bits: _bits, refs: _refs };
}
function loadTupleDataSize(source) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize', cells: _cells, bits: _bits, refs: _refs };
}
function loadGetterTupleDataSize(source) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize', cells: _cells, bits: _bits, refs: _refs };
}
function storeTupleDataSize(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.cells);
    builder.writeNumber(source.bits);
    builder.writeNumber(source.refs);
    return builder.build();
}
function dictValueParserDataSize() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeDataSize(src)).endCell());
        },
        parse: (src) => {
            return loadDataSize(src.loadRef().beginParse());
        }
    };
}
function storeSignedBundle(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeBuffer(src.signature);
        b_0.storeBuilder(src.signedData.asBuilder());
    };
}
function loadSignedBundle(slice) {
    const sc_0 = slice;
    const _signature = sc_0.loadBuffer(64);
    const _signedData = sc_0;
    return { $$type: 'SignedBundle', signature: _signature, signedData: _signedData };
}
function loadTupleSignedBundle(source) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle', signature: _signature, signedData: _signedData };
}
function loadGetterTupleSignedBundle(source) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle', signature: _signature, signedData: _signedData };
}
function storeTupleSignedBundle(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeSlice(source.signedData.asCell());
    return builder.build();
}
function dictValueParserSignedBundle() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeSignedBundle(src)).endCell());
        },
        parse: (src) => {
            return loadSignedBundle(src.loadRef().beginParse());
        }
    };
}
function storeStateInit(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeRef(src.code);
        b_0.storeRef(src.data);
    };
}
function loadStateInit(slice) {
    const sc_0 = slice;
    const _code = sc_0.loadRef();
    const _data = sc_0.loadRef();
    return { $$type: 'StateInit', code: _code, data: _data };
}
function loadTupleStateInit(source) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit', code: _code, data: _data };
}
function loadGetterTupleStateInit(source) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit', code: _code, data: _data };
}
function storeTupleStateInit(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    return builder.build();
}
function dictValueParserStateInit() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeStateInit(src)).endCell());
        },
        parse: (src) => {
            return loadStateInit(src.loadRef().beginParse());
        }
    };
}
function storeContext(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeBit(src.bounceable);
        b_0.storeAddress(src.sender);
        b_0.storeInt(src.value, 257);
        b_0.storeRef(src.raw.asCell());
    };
}
function loadContext(slice) {
    const sc_0 = slice;
    const _bounceable = sc_0.loadBit();
    const _sender = sc_0.loadAddress();
    const _value = sc_0.loadIntBig(257);
    const _raw = sc_0.loadRef().asSlice();
    return { $$type: 'Context', bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}
function loadTupleContext(source) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context', bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}
function loadGetterTupleContext(source) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context', bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}
function storeTupleContext(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeBoolean(source.bounceable);
    builder.writeAddress(source.sender);
    builder.writeNumber(source.value);
    builder.writeSlice(source.raw.asCell());
    return builder.build();
}
function dictValueParserContext() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeContext(src)).endCell());
        },
        parse: (src) => {
            return loadContext(src.loadRef().beginParse());
        }
    };
}
function storeSendParameters(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) {
            b_0.storeBit(true).storeRef(src.body);
        }
        else {
            b_0.storeBit(false);
        }
        if (src.code !== null && src.code !== undefined) {
            b_0.storeBit(true).storeRef(src.code);
        }
        else {
            b_0.storeBit(false);
        }
        if (src.data !== null && src.data !== undefined) {
            b_0.storeBit(true).storeRef(src.data);
        }
        else {
            b_0.storeBit(false);
        }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}
function loadSendParameters(slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _code = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _data = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'SendParameters', mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}
function loadTupleSendParameters(source) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters', mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}
function loadGetterTupleSendParameters(source) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters', mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}
function storeTupleSendParameters(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}
function dictValueParserSendParameters() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeSendParameters(src)).endCell());
        },
        parse: (src) => {
            return loadSendParameters(src.loadRef().beginParse());
        }
    };
}
function storeMessageParameters(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) {
            b_0.storeBit(true).storeRef(src.body);
        }
        else {
            b_0.storeBit(false);
        }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}
function loadMessageParameters(slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'MessageParameters', mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}
function loadTupleMessageParameters(source) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters', mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}
function loadGetterTupleMessageParameters(source) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters', mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}
function storeTupleMessageParameters(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}
function dictValueParserMessageParameters() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeMessageParameters(src)).endCell());
        },
        parse: (src) => {
            return loadMessageParameters(src.loadRef().beginParse());
        }
    };
}
function storeDeployParameters(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) {
            b_0.storeBit(true).storeRef(src.body);
        }
        else {
            b_0.storeBit(false);
        }
        b_0.storeInt(src.value, 257);
        b_0.storeBit(src.bounce);
        b_0.store(storeStateInit(src.init));
    };
}
function loadDeployParameters(slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _bounce = sc_0.loadBit();
    const _init = loadStateInit(sc_0);
    return { $$type: 'DeployParameters', mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}
function loadTupleDeployParameters(source) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadTupleStateInit(source);
    return { $$type: 'DeployParameters', mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}
function loadGetterTupleDeployParameters(source) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadGetterTupleStateInit(source);
    return { $$type: 'DeployParameters', mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}
function storeTupleDeployParameters(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeBoolean(source.bounce);
    builder.writeTuple(storeTupleStateInit(source.init));
    return builder.build();
}
function dictValueParserDeployParameters() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeDeployParameters(src)).endCell());
        },
        parse: (src) => {
            return loadDeployParameters(src.loadRef().beginParse());
        }
    };
}
function storeStdAddress(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 8);
        b_0.storeUint(src.address, 256);
    };
}
function loadStdAddress(slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(8);
    const _address = sc_0.loadUintBig(256);
    return { $$type: 'StdAddress', workchain: _workchain, address: _address };
}
function loadTupleStdAddress(source) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress', workchain: _workchain, address: _address };
}
function loadGetterTupleStdAddress(source) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress', workchain: _workchain, address: _address };
}
function storeTupleStdAddress(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeNumber(source.address);
    return builder.build();
}
function dictValueParserStdAddress() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeStdAddress(src)).endCell());
        },
        parse: (src) => {
            return loadStdAddress(src.loadRef().beginParse());
        }
    };
}
function storeVarAddress(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 32);
        b_0.storeRef(src.address.asCell());
    };
}
function loadVarAddress(slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(32);
    const _address = sc_0.loadRef().asSlice();
    return { $$type: 'VarAddress', workchain: _workchain, address: _address };
}
function loadTupleVarAddress(source) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress', workchain: _workchain, address: _address };
}
function loadGetterTupleVarAddress(source) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress', workchain: _workchain, address: _address };
}
function storeTupleVarAddress(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeSlice(source.address.asCell());
    return builder.build();
}
function dictValueParserVarAddress() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeVarAddress(src)).endCell());
        },
        parse: (src) => {
            return loadVarAddress(src.loadRef().beginParse());
        }
    };
}
function storeBasechainAddress(src) {
    return (builder) => {
        const b_0 = builder;
        if (src.hash !== null && src.hash !== undefined) {
            b_0.storeBit(true).storeInt(src.hash, 257);
        }
        else {
            b_0.storeBit(false);
        }
    };
}
function loadBasechainAddress(slice) {
    const sc_0 = slice;
    const _hash = sc_0.loadBit() ? sc_0.loadIntBig(257) : null;
    return { $$type: 'BasechainAddress', hash: _hash };
}
function loadTupleBasechainAddress(source) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress', hash: _hash };
}
function loadGetterTupleBasechainAddress(source) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress', hash: _hash };
}
function storeTupleBasechainAddress(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.hash);
    return builder.build();
}
function dictValueParserBasechainAddress() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeBasechainAddress(src)).endCell());
        },
        parse: (src) => {
            return loadBasechainAddress(src.loadRef().beginParse());
        }
    };
}
function storeDeploy(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeUint(2490013878, 32);
        b_0.storeUint(src.queryId, 64);
    };
}
function loadDeploy(slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2490013878) {
        throw Error('Invalid prefix');
    }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Deploy', queryId: _queryId };
}
function loadTupleDeploy(source) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy', queryId: _queryId };
}
function loadGetterTupleDeploy(source) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy', queryId: _queryId };
}
function storeTupleDeploy(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}
function dictValueParserDeploy() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadDeploy(src.loadRef().beginParse());
        }
    };
}
function storeDeployOk(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeUint(2952335191, 32);
        b_0.storeUint(src.queryId, 64);
    };
}
function loadDeployOk(slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2952335191) {
        throw Error('Invalid prefix');
    }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'DeployOk', queryId: _queryId };
}
function loadTupleDeployOk(source) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk', queryId: _queryId };
}
function loadGetterTupleDeployOk(source) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk', queryId: _queryId };
}
function storeTupleDeployOk(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}
function dictValueParserDeployOk() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeDeployOk(src)).endCell());
        },
        parse: (src) => {
            return loadDeployOk(src.loadRef().beginParse());
        }
    };
}
function storeFactoryDeploy(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeUint(1829761339, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.cashback);
    };
}
function loadFactoryDeploy(slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1829761339) {
        throw Error('Invalid prefix');
    }
    const _queryId = sc_0.loadUintBig(64);
    const _cashback = sc_0.loadAddress();
    return { $$type: 'FactoryDeploy', queryId: _queryId, cashback: _cashback };
}
function loadTupleFactoryDeploy(source) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy', queryId: _queryId, cashback: _cashback };
}
function loadGetterTupleFactoryDeploy(source) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy', queryId: _queryId, cashback: _cashback };
}
function storeTupleFactoryDeploy(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.cashback);
    return builder.build();
}
function dictValueParserFactoryDeploy() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeFactoryDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadFactoryDeploy(src.loadRef().beginParse());
        }
    };
}
function storeCreateValuation(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeUint(783258973, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeRef(src.user);
        b_0.storeRef(src.store);
        b_0.storeRef(src.valuationHash);
    };
}
function loadCreateValuation(slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 783258973) {
        throw Error('Invalid prefix');
    }
    const _query_id = sc_0.loadUintBig(64);
    const _user = sc_0.loadRef();
    const _store = sc_0.loadRef();
    const _valuationHash = sc_0.loadRef();
    return { $$type: 'CreateValuation', query_id: _query_id, user: _user, store: _store, valuationHash: _valuationHash };
}
function loadTupleCreateValuation(source) {
    const _query_id = source.readBigNumber();
    const _user = source.readCell();
    const _store = source.readCell();
    const _valuationHash = source.readCell();
    return { $$type: 'CreateValuation', query_id: _query_id, user: _user, store: _store, valuationHash: _valuationHash };
}
function loadGetterTupleCreateValuation(source) {
    const _query_id = source.readBigNumber();
    const _user = source.readCell();
    const _store = source.readCell();
    const _valuationHash = source.readCell();
    return { $$type: 'CreateValuation', query_id: _query_id, user: _user, store: _store, valuationHash: _valuationHash };
}
function storeTupleCreateValuation(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeCell(source.user);
    builder.writeCell(source.store);
    builder.writeCell(source.valuationHash);
    return builder.build();
}
function dictValueParserCreateValuation() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeCreateValuation(src)).endCell());
        },
        parse: (src) => {
            return loadCreateValuation(src.loadRef().beginParse());
        }
    };
}
function storeSetValuationStatus(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeUint(1435206154, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.id, 32);
        b_0.storeUint(src.status, 8);
    };
}
function loadSetValuationStatus(slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1435206154) {
        throw Error('Invalid prefix');
    }
    const _query_id = sc_0.loadUintBig(64);
    const _id = sc_0.loadUintBig(32);
    const _status = sc_0.loadUintBig(8);
    return { $$type: 'SetValuationStatus', query_id: _query_id, id: _id, status: _status };
}
function loadTupleSetValuationStatus(source) {
    const _query_id = source.readBigNumber();
    const _id = source.readBigNumber();
    const _status = source.readBigNumber();
    return { $$type: 'SetValuationStatus', query_id: _query_id, id: _id, status: _status };
}
function loadGetterTupleSetValuationStatus(source) {
    const _query_id = source.readBigNumber();
    const _id = source.readBigNumber();
    const _status = source.readBigNumber();
    return { $$type: 'SetValuationStatus', query_id: _query_id, id: _id, status: _status };
}
function storeTupleSetValuationStatus(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.id);
    builder.writeNumber(source.status);
    return builder.build();
}
function dictValueParserSetValuationStatus() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeSetValuationStatus(src)).endCell());
        },
        parse: (src) => {
            return loadSetValuationStatus(src.loadRef().beginParse());
        }
    };
}
function storeValuation(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeRef(src.user);
        b_0.storeRef(src.store);
        b_0.storeRef(src.valuationHash);
        b_0.storeUint(src.status, 8);
        b_0.storeUint(src.timestamp, 32);
    };
}
function loadValuation(slice) {
    const sc_0 = slice;
    const _user = sc_0.loadRef();
    const _store = sc_0.loadRef();
    const _valuationHash = sc_0.loadRef();
    const _status = sc_0.loadUintBig(8);
    const _timestamp = sc_0.loadUintBig(32);
    return { $$type: 'Valuation', user: _user, store: _store, valuationHash: _valuationHash, status: _status, timestamp: _timestamp };
}
function loadTupleValuation(source) {
    const _user = source.readCell();
    const _store = source.readCell();
    const _valuationHash = source.readCell();
    const _status = source.readBigNumber();
    const _timestamp = source.readBigNumber();
    return { $$type: 'Valuation', user: _user, store: _store, valuationHash: _valuationHash, status: _status, timestamp: _timestamp };
}
function loadGetterTupleValuation(source) {
    const _user = source.readCell();
    const _store = source.readCell();
    const _valuationHash = source.readCell();
    const _status = source.readBigNumber();
    const _timestamp = source.readBigNumber();
    return { $$type: 'Valuation', user: _user, store: _store, valuationHash: _valuationHash, status: _status, timestamp: _timestamp };
}
function storeTupleValuation(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeCell(source.user);
    builder.writeCell(source.store);
    builder.writeCell(source.valuationHash);
    builder.writeNumber(source.status);
    builder.writeNumber(source.timestamp);
    return builder.build();
}
function dictValueParserValuation() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeValuation(src)).endCell());
        },
        parse: (src) => {
            return loadValuation(src.loadRef().beginParse());
        }
    };
}
function storeDhahabyValuation$Data(src) {
    return (builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner);
        b_0.storeUint(src.nextId, 32);
        b_0.storeDict(src.vals, core_1.Dictionary.Keys.Uint(32), dictValueParserValuation());
    };
}
function loadDhahabyValuation$Data(slice) {
    const sc_0 = slice;
    const _owner = sc_0.loadAddress();
    const _nextId = sc_0.loadUintBig(32);
    const _vals = core_1.Dictionary.load(core_1.Dictionary.Keys.Uint(32), dictValueParserValuation(), sc_0);
    return { $$type: 'DhahabyValuation$Data', owner: _owner, nextId: _nextId, vals: _vals };
}
function loadTupleDhahabyValuation$Data(source) {
    const _owner = source.readAddress();
    const _nextId = source.readBigNumber();
    const _vals = core_1.Dictionary.loadDirect(core_1.Dictionary.Keys.Uint(32), dictValueParserValuation(), source.readCellOpt());
    return { $$type: 'DhahabyValuation$Data', owner: _owner, nextId: _nextId, vals: _vals };
}
function loadGetterTupleDhahabyValuation$Data(source) {
    const _owner = source.readAddress();
    const _nextId = source.readBigNumber();
    const _vals = core_1.Dictionary.loadDirect(core_1.Dictionary.Keys.Uint(32), dictValueParserValuation(), source.readCellOpt());
    return { $$type: 'DhahabyValuation$Data', owner: _owner, nextId: _nextId, vals: _vals };
}
function storeTupleDhahabyValuation$Data(source) {
    const builder = new core_1.TupleBuilder();
    builder.writeAddress(source.owner);
    builder.writeNumber(source.nextId);
    builder.writeCell(source.vals.size > 0 ? (0, core_1.beginCell)().storeDictDirect(source.vals, core_1.Dictionary.Keys.Uint(32), dictValueParserValuation()).endCell() : null);
    return builder.build();
}
function dictValueParserDhahabyValuation$Data() {
    return {
        serialize: (src, builder) => {
            builder.storeRef((0, core_1.beginCell)().store(storeDhahabyValuation$Data(src)).endCell());
        },
        parse: (src) => {
            return loadDhahabyValuation$Data(src.loadRef().beginParse());
        }
    };
}
function initDhahabyValuation_init_args(src) {
    return (builder) => {
        const b_0 = builder;
    };
}
async function DhahabyValuation_init() {
    const __code = core_1.Cell.fromHex('b5ee9c7241020e0100025b000228ff008e88f4a413f4bcf2c80bed5320e303ed43d9010902027102070201580305013db423fda89a1a4000335f481a63fe808aa40d8272a61f084e0dbc5b678d863004000221016db7a33da89a1a4000335f481a63fe808aa40d8272a61f084e0dbc4aa05b678d86240dd2460db3240dde5a100de4ade0bc440dd2460dbbd00600448020220259f40f6fa192306ddf206e92306d9ed0d4d4d4d307d31f55406c156f05e2013dbc744f6a268690000cd7d20698ffa022a903609ca987c213836f16d9e3618c0800022203be3001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019afa40d31ff40455206c139530f842706de204925f04e002d70d1ff2e0822182102eaf955dbae302218210558b820abae302018210946a98b6bae3025f04f2c0820a0b0d009c31d33f31d4d4d43082008283f84225c705f2f424a4802070f82310465e32c855405045cc12cccccb07cb1fc9103514206e953059f45b30944133f417e2c87f01ca0055205023cecb1ff400c9ed5401fe31d33f31d31fd30730814ec4f84224c705f2f48200a74d2580202459f40e6fa131f2f48113ce21c001917f9321c002e2f2f42480202359f40f6fa192306ddf206e92306d9ed0d4d4d4d307d31f55406c156f05e2206ef2d0806f253180205055c855405045cc12cccccb07cb1fc9103512206e953059f45b30944133f417e20c0022c87f01ca0055205023cecb1ff400c9ed54008cd33f30c8018210aff90f5758cb1fcb3fc913f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00c87f01ca0055205023cecb1ff400c9ed545d2ea52f');
    const builder = (0, core_1.beginCell)();
    builder.storeUint(0, 1);
    initDhahabyValuation_init_args({ $$type: 'DhahabyValuation_init_args' })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}
exports.DhahabyValuation_errors = {
    2: { message: "Stack underflow" },
    3: { message: "Stack overflow" },
    4: { message: "Integer overflow" },
    5: { message: "Integer out of expected range" },
    6: { message: "Invalid opcode" },
    7: { message: "Type check error" },
    8: { message: "Cell overflow" },
    9: { message: "Cell underflow" },
    10: { message: "Dictionary error" },
    11: { message: "'Unknown' error" },
    12: { message: "Fatal error" },
    13: { message: "Out of gas error" },
    14: { message: "Virtualization error" },
    32: { message: "Action list is invalid" },
    33: { message: "Action list is too long" },
    34: { message: "Action is invalid or not supported" },
    35: { message: "Invalid source address in outbound message" },
    36: { message: "Invalid destination address in outbound message" },
    37: { message: "Not enough Toncoin" },
    38: { message: "Not enough extra currencies" },
    39: { message: "Outbound message does not fit into a cell after rewriting" },
    40: { message: "Cannot process a message" },
    41: { message: "Library reference is null" },
    42: { message: "Library change action error" },
    43: { message: "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree" },
    50: { message: "Account state size exceeded limits" },
    128: { message: "Null reference exception" },
    129: { message: "Invalid serialization prefix" },
    130: { message: "Invalid incoming message" },
    131: { message: "Constraints error" },
    132: { message: "Access denied" },
    133: { message: "Contract stopped" },
    134: { message: "Invalid argument" },
    135: { message: "Code of a contract was not found" },
    136: { message: "Invalid standard address" },
    138: { message: "Not a basechain address" },
    5070: { message: "Invalid status: Must be 1 (approved) or 2 (rejected)." },
    20164: { message: "Unauthorized: Only owner can set status." },
    33411: { message: "Unauthorized: Only owner can create valuation." },
    42829: { message: "Valuation ID not found." },
};
exports.DhahabyValuation_errors_backward = {
    "Stack underflow": 2,
    "Stack overflow": 3,
    "Integer overflow": 4,
    "Integer out of expected range": 5,
    "Invalid opcode": 6,
    "Type check error": 7,
    "Cell overflow": 8,
    "Cell underflow": 9,
    "Dictionary error": 10,
    "'Unknown' error": 11,
    "Fatal error": 12,
    "Out of gas error": 13,
    "Virtualization error": 14,
    "Action list is invalid": 32,
    "Action list is too long": 33,
    "Action is invalid or not supported": 34,
    "Invalid source address in outbound message": 35,
    "Invalid destination address in outbound message": 36,
    "Not enough Toncoin": 37,
    "Not enough extra currencies": 38,
    "Outbound message does not fit into a cell after rewriting": 39,
    "Cannot process a message": 40,
    "Library reference is null": 41,
    "Library change action error": 42,
    "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43,
    "Account state size exceeded limits": 50,
    "Null reference exception": 128,
    "Invalid serialization prefix": 129,
    "Invalid incoming message": 130,
    "Constraints error": 131,
    "Access denied": 132,
    "Contract stopped": 133,
    "Invalid argument": 134,
    "Code of a contract was not found": 135,
    "Invalid standard address": 136,
    "Not a basechain address": 138,
    "Invalid status: Must be 1 (approved) or 2 (rejected).": 5070,
    "Unauthorized: Only owner can set status.": 20164,
    "Unauthorized: Only owner can create valuation.": 33411,
    "Valuation ID not found.": 42829,
};
const DhahabyValuation_types = [
    { "name": "DataSize", "header": null, "fields": [{ "name": "cells", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "bits", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "refs", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }] },
    { "name": "SignedBundle", "header": null, "fields": [{ "name": "signature", "type": { "kind": "simple", "type": "fixed-bytes", "optional": false, "format": 64 } }, { "name": "signedData", "type": { "kind": "simple", "type": "slice", "optional": false, "format": "remainder" } }] },
    { "name": "StateInit", "header": null, "fields": [{ "name": "code", "type": { "kind": "simple", "type": "cell", "optional": false } }, { "name": "data", "type": { "kind": "simple", "type": "cell", "optional": false } }] },
    { "name": "Context", "header": null, "fields": [{ "name": "bounceable", "type": { "kind": "simple", "type": "bool", "optional": false } }, { "name": "sender", "type": { "kind": "simple", "type": "address", "optional": false } }, { "name": "value", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "raw", "type": { "kind": "simple", "type": "slice", "optional": false } }] },
    { "name": "SendParameters", "header": null, "fields": [{ "name": "mode", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "body", "type": { "kind": "simple", "type": "cell", "optional": true } }, { "name": "code", "type": { "kind": "simple", "type": "cell", "optional": true } }, { "name": "data", "type": { "kind": "simple", "type": "cell", "optional": true } }, { "name": "value", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "to", "type": { "kind": "simple", "type": "address", "optional": false } }, { "name": "bounce", "type": { "kind": "simple", "type": "bool", "optional": false } }] },
    { "name": "MessageParameters", "header": null, "fields": [{ "name": "mode", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "body", "type": { "kind": "simple", "type": "cell", "optional": true } }, { "name": "value", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "to", "type": { "kind": "simple", "type": "address", "optional": false } }, { "name": "bounce", "type": { "kind": "simple", "type": "bool", "optional": false } }] },
    { "name": "DeployParameters", "header": null, "fields": [{ "name": "mode", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "body", "type": { "kind": "simple", "type": "cell", "optional": true } }, { "name": "value", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }, { "name": "bounce", "type": { "kind": "simple", "type": "bool", "optional": false } }, { "name": "init", "type": { "kind": "simple", "type": "StateInit", "optional": false } }] },
    { "name": "StdAddress", "header": null, "fields": [{ "name": "workchain", "type": { "kind": "simple", "type": "int", "optional": false, "format": 8 } }, { "name": "address", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 256 } }] },
    { "name": "VarAddress", "header": null, "fields": [{ "name": "workchain", "type": { "kind": "simple", "type": "int", "optional": false, "format": 32 } }, { "name": "address", "type": { "kind": "simple", "type": "slice", "optional": false } }] },
    { "name": "BasechainAddress", "header": null, "fields": [{ "name": "hash", "type": { "kind": "simple", "type": "int", "optional": true, "format": 257 } }] },
    { "name": "Deploy", "header": 2490013878, "fields": [{ "name": "queryId", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 64 } }] },
    { "name": "DeployOk", "header": 2952335191, "fields": [{ "name": "queryId", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 64 } }] },
    { "name": "FactoryDeploy", "header": 1829761339, "fields": [{ "name": "queryId", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 64 } }, { "name": "cashback", "type": { "kind": "simple", "type": "address", "optional": false } }] },
    { "name": "CreateValuation", "header": 783258973, "fields": [{ "name": "query_id", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 64 } }, { "name": "user", "type": { "kind": "simple", "type": "cell", "optional": false } }, { "name": "store", "type": { "kind": "simple", "type": "cell", "optional": false } }, { "name": "valuationHash", "type": { "kind": "simple", "type": "cell", "optional": false } }] },
    { "name": "SetValuationStatus", "header": 1435206154, "fields": [{ "name": "query_id", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 64 } }, { "name": "id", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 32 } }, { "name": "status", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 8 } }] },
    { "name": "Valuation", "header": null, "fields": [{ "name": "user", "type": { "kind": "simple", "type": "cell", "optional": false } }, { "name": "store", "type": { "kind": "simple", "type": "cell", "optional": false } }, { "name": "valuationHash", "type": { "kind": "simple", "type": "cell", "optional": false } }, { "name": "status", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 8 } }, { "name": "timestamp", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 32 } }] },
    { "name": "DhahabyValuation$Data", "header": null, "fields": [{ "name": "owner", "type": { "kind": "simple", "type": "address", "optional": false } }, { "name": "nextId", "type": { "kind": "simple", "type": "uint", "optional": false, "format": 32 } }, { "name": "vals", "type": { "kind": "dict", "key": "uint", "keyFormat": 32, "value": "Valuation", "valueFormat": "ref" } }] },
];
const DhahabyValuation_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "CreateValuation": 783258973,
    "SetValuationStatus": 1435206154,
};
const DhahabyValuation_getters = [
    { "name": "getValuation", "methodId": 97561, "arguments": [{ "name": "id", "type": { "kind": "simple", "type": "int", "optional": false, "format": 257 } }], "returnType": { "kind": "simple", "type": "Valuation", "optional": true } },
    { "name": "getNextId", "methodId": 82207, "arguments": [], "returnType": { "kind": "simple", "type": "int", "optional": false, "format": 257 } },
    { "name": "getOwner", "methodId": 102025, "arguments": [], "returnType": { "kind": "simple", "type": "address", "optional": false } },
];
exports.DhahabyValuation_getterMapping = {
    'getValuation': 'getGetValuation',
    'getNextId': 'getGetNextId',
    'getOwner': 'getGetOwner',
};
const DhahabyValuation_receivers = [
    { "receiver": "internal", "message": { "kind": "typed", "type": "CreateValuation" } },
    { "receiver": "internal", "message": { "kind": "typed", "type": "SetValuationStatus" } },
    { "receiver": "internal", "message": { "kind": "typed", "type": "Deploy" } },
];
class DhahabyValuation {
    static async init() {
        return await DhahabyValuation_init();
    }
    static async fromInit() {
        const __gen_init = await DhahabyValuation_init();
        const address = (0, core_1.contractAddress)(0, __gen_init);
        return new DhahabyValuation(address, __gen_init);
    }
    static fromAddress(address) {
        return new DhahabyValuation(address);
    }
    constructor(address, init) {
        this.abi = {
            types: DhahabyValuation_types,
            getters: DhahabyValuation_getters,
            receivers: DhahabyValuation_receivers,
            errors: exports.DhahabyValuation_errors,
        };
        this.address = address;
        this.init = init;
    }
    async send(provider, via, args, message) {
        let body = null;
        if (message && typeof message === 'object' && !(message instanceof core_1.Slice) && message.$$type === 'CreateValuation') {
            body = (0, core_1.beginCell)().store(storeCreateValuation(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof core_1.Slice) && message.$$type === 'SetValuationStatus') {
            body = (0, core_1.beginCell)().store(storeSetValuationStatus(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof core_1.Slice) && message.$$type === 'Deploy') {
            body = (0, core_1.beginCell)().store(storeDeploy(message)).endCell();
        }
        if (body === null) {
            throw new Error('Invalid message type');
        }
        await provider.internal(via, { ...args, body: body });
    }
    async getGetValuation(provider, id) {
        const builder = new core_1.TupleBuilder();
        builder.writeNumber(id);
        const source = (await provider.get('getValuation', builder.build())).stack;
        const result_p = source.readTupleOpt();
        const result = result_p ? loadTupleValuation(result_p) : null;
        return result;
    }
    async getGetNextId(provider) {
        const builder = new core_1.TupleBuilder();
        const source = (await provider.get('getNextId', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    async getGetOwner(provider) {
        const builder = new core_1.TupleBuilder();
        const source = (await provider.get('getOwner', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
}
exports.DhahabyValuation = DhahabyValuation;
DhahabyValuation.storageReserve = 0n;
DhahabyValuation.errors = exports.DhahabyValuation_errors_backward;
DhahabyValuation.opcodes = DhahabyValuation_opcodes;
