import getWeb3 from '../util/getWeb3'
import Whisper from '../whisper/whisper'
import Eth from 'ethjs-query'
import EthContract from 'ethjs-contract'
import abi from 'ethjs-abi'
import RegistryContractABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
import EthrDID from 'ethr-did'
import {verifyJWT} from 'did-jwt'
import register from 'ethr-did-resolver'
import {stringToBytes32, bytes32toString} from 'ethr-did-resolver'
import interval from 'interval-promise'
import resolver from 'did-resolver'


class Channel {
    constructor (conf = {}) {
        this.registryAddress = conf.registryAddress || null; 
        this.topic = conf.topic || null; 
        this.accounts = conf.accounts || null; 
        this.identity = conf.identity || null; 
        this.identity2 = conf.identity2 || null;
        this.did = `did:ethr:${this.identity}`
        this.did2 = `did:ethr:${this.identity2}`
        this.signer = null;
        this.signer2 = null;
        this.pubKey = null;
        this.pubKey2 = null;
        this.registry = null;
        this.whisper = null;
        this.ethrDid = null;
        this.sendCount = 0;
        this.inData = [];
        this.stoppedChannel = false;

        getWeb3.then(results => {
            this.web3 = results.web3Instance;
            this.provider = results.web3Provider;
            try {
                this.eth = new Eth(this.provider)
                this.DidReg = new EthContract(this.eth)(RegistryContractABI)
                this.ethrDid = new EthrDID({provider: this.provider, registry: this.registryAddress, address: this.identity});
                this.whisper = new Whisper();
                this.registry = this.DidReg.at(this.registryAddress)
            } catch (err) {console.log("Channel init error: ",err);}
        }).catch(console.log);
    }


    async open(){
        const self = this;

        const setPublicKey = (topic, pubKey, delegateNum) =>
            new Promise(async (resolve, reject) => {
                let tx = await self.ethrDid.setAttribute('chPubKey#' + topic + delegateNum, pubKey).catch(console.log)
                let res = {pubKey:"0x"}
                let i = 0;
                while(res.pubKey !== pubKey ){
                    await sleep(1);
                    res = await self.getIdPubKey(self.identity,topic);
                    i++;
                    if(i >= 300){
                        reject("Waited 5 mins to set public key.");
                        break;
                    }
                }
                resolve(tx)
            })
 
        const setSigner = () =>
            new Promise(async (resolve, reject) => {
                let {kp} = await self.ethrDid.createSigningDelegate().catch(console.log)
                let doc = {publicKey:[]};
                let valid = false; 
                let delNum;
                let i = 0;
                while(!valid){
                    doc.publicKey.forEach(element => {
                        if(element.ethereumAddress === kp.address){
                            valid = true;
                            let shPos = element.id.indexOf("-")
                            delNum = element.id.substring(shPos, element.id.length)
                            
                        } else {
                            valid = false;
                        }
                    });
                    await sleep(1);
                    doc = await resolver(self.did);
                    i++;
                    if(i >= 300){
                        reject("Waited 5 mins to set signer.");
                        break;
                    }
                }
                resolve({kp,delNum})
            })

        const getSigner = (delNum) =>
            new Promise(async (resolve, reject) => {
                let doc = {publicKey:[]};
                let valid = false; 
                let signer = null;
                let i = 0;
                while(!valid){
                    doc.publicKey.forEach(element => {
                        let dPos = element.id.indexOf("-") 
                        let delNumIn = element.id.substring(dPos, element.id.length)
                        if(delNum === delNumIn && (element.id.match(/delegate/g) || []).length === 1){
                            valid = true; 
                            signer = element.ethereumAddress;
                        } else {
                            valid = false;
                        }
                    });
                    await sleep(1);
                    doc = await resolver(self.did2);
                    i++;
                    if(i >= 300){
                        reject("Waited 5 mins to get signer.");
                        break;
                    }
                }
                resolve(signer)
            })
 
        try{

            register({provider: self.provider, registry: self.registryAddress}); // used by resolver
            
            console.log("Set signer delegate.");
            let signer  = await setSigner();
            let whispInit =  await self.whisper.init(self.topic).catch(console.log);

            console.log("Set Whisper asymmetric public key.");
            await setPublicKey(self.topic, whispInit.id.pubKey, signer.delNum)
            self.signer = signer.kp.address;
            self.pubKey = whispInit.id.pubKey;

            let longStr = true;
            let i = 0;
            while(!self.signer2){
                let delegate2 = await self.getIdPubKey(self.identity2, self.topic);
                self.pubKey2 = delegate2.pubKey;
                if(!delegate2.pubKey){
                    if(longStr){
                        console.log("Waiting the other peer...");
                        longStr = false;
                    }else{
                        //console.log("...");
                    }
                }else {
                    self.signer2  = await getSigner(delegate2.delegateNum);
                }
                await sleep(1);
                i++;
                if(i >= 600){
                    throw new Error("error: waited 10 mins. ")
                }
            }
            return {whisperId: whispInit.id, signer: signer.kp } 
        } catch (err) {
            console.log("Set channel error: ",err);
            throw new Error("error: unable to connect with other peer. ")
        }

    }

    // TODO: validate revoked attributes
    async getIdPubKey(identity,topic){
        try{
            let pubKey, delegateNum;
            const history = await changeLog(identity,this.eth,this.registryAddress,this.registry).catch(console.log); 
            history.forEach(event => {
                if(!event.name){
                    /*console.log(event._eventName,event.name)
                    if (event._eventName === 'DIDDelegateChanged') {
                        console.log(bytes32toString(event.delegateType),event.delegateType)
                    }
                    */
                } else{
                    let strAttribute = bytes32toString(event.name);
                    if(event._eventName === 'DIDAttributeChanged' && (strAttribute.match(/chPubKey/g) || []).length === 1){
                        let chPos = strAttribute.search("chPubKey")
                        let tPos = strAttribute.indexOf("#")
                        let dPos = strAttribute.indexOf("-")
                        if( chPos === 0 &&  tPos === 8){
                            if(strAttribute.substring(tPos + 1, strAttribute.length - (strAttribute.length-dPos)) === topic){
                                pubKey = event.value;
                                delegateNum =  strAttribute.substring(dPos, strAttribute.length);
                            }
                        }
                    }
                }
            });
            return {pubKey,delegateNum};
        } catch (err) {
            console.log("getIdPubKey error: ",err);
        }

        async function lastChanged (identity,registry){
            const result = await registry.changed(identity).catch(console.log); 
            if (result) {return result['0']}
        }
    
        async function changeLog (identity,eth,registryAddress,registry) {
            const logDecoder = abi.logDecoder(RegistryContractABI, false)
            const history = []
            let previousChange = await lastChanged(identity,registry).catch(console.log); 
            while (previousChange) {
                const logs = await eth.getLogs({address: registryAddress, topics: [null, `0x000000000000000000000000${identity.slice(2)}`], fromBlock: previousChange, toBlock: previousChange}).catch(console.log); 
                const events = logDecoder(logs)
                previousChange = undefined
                for (let event of events) {
                history.unshift(event)
                previousChange = event.previousChange
                }
            }
        return history
        }
    }


    async send(msg){
        const self = this;
        if (!self.stoppedChannel) {
            let jwt = await self.ethrDid.signJWT(msg).catch(console.log); 
            let hash = self.web3.utils.sha3(JSON.stringify({jwt, nonce:self.sendCount}));
            let info = {jwt,hash,nonce:self.sendCount};
            let tx = await self.whisper.sendMessage(info,{pubKey:self.pubKey2}).catch(console.log);
            self.sendCount ++; 
            return {jwt,tx};
        }else {
            return null;
        }
    }


    async start(){
        const self = this;
        self.stoppedChannel = false;
        interval(async () => {
            if (self.stoppedChannel) {
                    // no other way to stop the async interval.
                    throw new Error("stopChannel")
                }else {
                    let messages = await self.whisper.receiveMessage().catch(console.log); 
                    if (messages.raw.length > 0){
                        messages.data
                        .forEach(async (message) => {
                            let data = await verifyJWT(message.jwt).catch(console.log);
                            if(data.signer.ethereumAddress === self.signer2 && data.signer.owner === self.did2){
                                self.inData.push(
                                    {data: data.payload,
                                    signer: data.signer,
                                    jwt: data.jwt,
                                    nonce: message.nonce, 
                                    hash: message.hash}
                                    ); 
                            }else{ console.log("Invalid message received in channel")}
                        })
                    }
                }
        }, 100)
        .catch(err => {
            if(err.message === "stopChannel"){
                return false;
            } else {
                console.log(err)
            }
        })
        return true;
    }

    async pause(){ 
        const self = this;
        self.stoppedChannel = true 
        return self.stoppedChannel;
    }

    async close(){
        const self = this;

        self.stoppedChannel = true;
        console.log("Revoke signer delegate.")
        await self.ethrDid.revokeDelegate(self.signer);

        await sleep(3); //Race condition, TODO: promisify
        console.log("Revoke Whisper asymmetric public key.")
        const id = await self.getIdPubKey(self.identity, self.topic);
        const owner = await self.ethrDid.lookupOwner();
        const name = "chPubKey#" + self.topic + id.delegateNum;
        self.registry.revokeAttribute(self.identity, stringToBytes32(name) , id.pubKey, {from: owner});

        //self.ethrDid.revokeAttribute(name, id.pubKey);
        
        self.identity = null; 
        self.identity2 =  null;
        self.did =  null;
        self.did2 =  null;
        self.signer = null;
        self.signer2 = null;
        self.pubKey = null;
        self.pubKey2 = null;  
        
        return true;
    }

    read(){
        return (this.inData);
    }
}

export default Channel;


export const createChannel = (conf) =>
new Promise(async (resolve, reject) => {
    let longStr = true;
    let channel = new Channel(conf);
    let i = 0;
    while(channel.registry === null || channel.whisper === null || channel.ethrDid === null )
    {                      
        if(longStr){
            console.log("Creating channel...");
            await sleep(2); 
            longStr = false;
        }else {
            console.log("...");
        }
        i++;

        if(i >= 120){
            reject("Cannot create channel.");
            break;
        }
    }
    resolve(channel)
    
})

export  const getAccounts = (web3) => 
new Promise((resolve, reject) => 
web3.eth.getAccounts((error, accounts) => 
        error ? reject(error) : resolve(accounts)
    )
)

export function Topic() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 6; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

export function sleep (seconds) {
    return new Promise((resolve, reject) => setTimeout(resolve, seconds * 1000));
}
