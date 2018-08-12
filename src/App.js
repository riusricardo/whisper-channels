import React, { Component } from 'react'
import Terminal from 'terminal-in-react'
import DidRegistryContract from 'ethr-did-registry'
import contract from 'truffle-contract'
import getWeb3 from './util/getWeb3'
import {Topic} from './channel/channel'
import {createChannel} from './channel/channel'
import {getAccounts} from './channel/channel'
import {sleep} from './channel/channel'
import './App.css';

class App extends Component {

    async init() {
      const useWeb3 = () => getWeb3;
      const results = await useWeb3();
      let accounts = await getAccounts(results.web3);
      let identity = accounts[0].toLowerCase();
      //let identity2 = accounts[1].toLowerCase();

      console.log("Deploy Test Ethr DID Registry.")
      let registryAddress = await truffleDeploy(results.provider,accounts);
      
      let topic = Topic();
      console.log("Topic: ",topic);
      let channel = await createChannel({registryAddress: registryAddress, identity: identity, identity2: identity, topic});
      
      let ch = await channel.open()
      console.log("Whisper Id: ",ch.whisperId);

      await channel.start();

      let msg = {message: "Hello World"};
      await channel.send(msg);

      console.log("Identity address: ", identity);
      console.log("My Signer: ",ch.signer);

      await sleep(3)
      console.log("Received Message:",channel.read());

      await sleep(2)
      await channel.close();
      console.log("Channel closed.")
    }

render() {
    return (
      <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh"
      }}
      >
      <Terminal
        color='green'
        backgroundColor='black'
        barColor='gray'
        style={{ fontWeight: "bold", fontSize: "1.0em" }}
        commands={{
          showmsg: () => 'Whisper two way communication channels',
          init: this.init()
        }}
        descriptions={{
          showmsg: 'shows a message'
        }}
        startState = 'maximised'
        msg='Two way Ethereum Whisper channels using asymetric key encription. Public keys exchange on the Ethr DID registry.'
      />
      </div>
    )
  }
}
export default App;


async function truffleDeploy(provider,accounts){
  //Deploy new testing contract on every run
  const TDidReg = contract(DidRegistryContract);
  TDidReg.setProvider(provider);

  const Tregistry = await TDidReg.new({
      from: accounts[0],
      gasPrice: 1000000000,
      gas: 4712388
  })

  return Tregistry.address;
}
