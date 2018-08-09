import React, { Component } from 'react';
import getWeb3 from './util/getWeb3'
import {Topic} from './channel/channel'
import {createChannel} from './channel/channel'
import {getAccounts} from './channel/channel'
import {sleep} from './channel/channel'
import './App.css';

class App extends Component {
	constructor(props) {
		super(props);

	this.handleClick = this.handleClick.bind(this);
	  }

    async handleClick() {
        console.log('From handleClick()', this);
        
        const useWeb3 = () => getWeb3;
        const results = await useWeb3();
        let accounts = await getAccounts(results.web3);
        let identity = accounts[0].toLowerCase();
        //let identity2 = accounts[1].toLowerCase();
        let registryAddress = '0x7bb50ecce063b4875ffb3e106f330decc8561508';
        let msg = {
            message: 'fire',
            seq: 0,
            address: identity
        };

        let topic = Topic();
        let channel = await createChannel({registryAddress,identity,identity2:identity, topic});
        let ch = await channel.open()
        let signer = ch.signer;
        await channel.start();
        await channel.send(msg);
        await sleep(1)
        console.log(channel.read());
        await sleep(2)
        await channel.close();
}

render() {
    console.log('From render()', this);
    return (
      <div>
        <button onClick={() => this.handleClick()}>Start</button>
      </div>
    )
  }
}
export default App;