import getWeb3 from '../util/getWeb3'

class Whisper {
    constructor () {
        getWeb3.then(results => {
                this.web3 = results.web3Fallback;
                this.provider = results.providerFallback;
            }).catch(console.log);
        this.asymKeyId = null;
        this.asymPubKey = null;
        this.asymPrivKey = null;
        this.msgFilter = null;
        this.topic = null;
        this.recipientPubKey = null;    
         
    }

    async init(topic){
        let version,id,filter
        try {
            this.shh = this.web3.shh;
            version = await this.shh.getVersion().catch(
                err => {throw new Error("error: unable to get whisper shh version. ",err)}); 
            if (version >= 5) {
                id = await this.createKeyPair().catch(
                    err => {throw new Error("error: unable to create key pair. ",err)}); 
                if(!topic){
                    throw new Error("missing: topic");
                }else {
                    filter = await this.setTopic(topic,id.keyId).catch(
                        err => {throw new Error("error: unable to set topic. ",err)}); 
                }
            } else {
                throw new Error("Version of whisper not supported");
            }
            return {id,filter};
        } catch (err) {
            console.log("Whisper init error: ",err);
        }

    }
        
    async createKeyPair(){
        try{
            let keyId = await this.shh.newKeyPair().catch(
                err => {throw new Error("error: unable to generate key pair. ",err)});  
            let pubKey = await this.shh.getPublicKey(keyId).catch(
                err => {throw new Error("error: unable to get public key. ",err)}); 
            let privKey = await this.shh.getPrivateKey(keyId).catch(
                err => {throw new Error("error: unable to get private key. ",err)});  
            this.asymKeyId = keyId;
            this.asymPubKey = pubKey;
            this.asymPrivKey = privKey;
            return {keyId, pubKey, privKey};
        }catch (err) {
            console.log("Create key pair error: ",err);
        }
    
    }

    async setTopic(topic, id){
        let privateKeyID = id || this.asymKeyId;
        try{
            let topics = this.web3.utils.toHex(topic).slice(0, 10);
            if(!privateKeyID) {
                throw new Error("No valid asymmetric key");
            }
            let filter = {
                topics: [topics],
                privateKeyID
            };
            this.topic = topics;
            this.msgFilter = await this.shh.newMessageFilter(filter).catch(
                err => {throw new Error("error: can't create new filter. ",err)}); 

            return this.msgFilter;
        }catch (err) {
            console.log("Set topic error: ",err);
        }
    }
	
    async sendMessage(msg, options={}) {
        let topic = options.topic || this.topic;
        let ttl = options.ttl || 100;
        let powTime = options.powTime || 10;
        let powTarget = options.powTarget || 2.0;
        let pubKey = options.pubKey || this.asymPubKey;
        let sig = options.asymKeyId || this.asymKeyId;
        try{
            let payload = options.payload || this.web3.utils.toHex(JSON.stringify(msg));
            if (!topic) {
                throw new Error("missing: topic");
            }if (!payload) {
                throw new Error("missing: msg");
            }if (!sig) {
                throw new Error("missing: sig");
            }if (!pubKey) {
                throw new Error("missing: pubKey");
            }
            let postData = {
                ttl,
                topic,
                powTarget,
                powTime,
                payload,
                pubKey,
                sig
            };
            let hash = await this.shh.post(postData).catch(
                err => {throw new Error("error: ssh post data. ",err)});  
            return (hash);
        }catch (err) {
            console.log("Send message error: ",err);
        }
    }

    async receiveMessage(options={}) {
        let data = [], message;
        let msgFilter = options.msgFilter || this.msgFilter;
        try{
            let raw = await this.shh.getFilterMessages(msgFilter).catch(
                err => {throw new Error("error: unable to get filtered data. ",err)});   
            raw.forEach(msg => {
                    message = JSON.parse(this.web3.utils.hexToUtf8(msg.payload));
                    data.push(message);
                });   
            return {data,raw};
        }catch (err) {
            console.log("Receive message error: ",err);
        }
    }
}
export default Whisper;