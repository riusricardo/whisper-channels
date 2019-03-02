import Web3 from 'web3'
import HttpProvider from 'ethjs-provider-http'

const providerFallback = new Web3.providers.WebsocketProvider('ws://localhost:8546');
const web3Fallback = new Web3(providerFallback);
 
const getWeb3 = () =>
  new Promise((resolve, reject) => {
    // Wait for loading completion to avoid race conditions with web3 injection timing.
    window.addEventListener("load", async () => {
      let results
      // Modern dapp browsers...
      if (window.ethereum) {
        const web3 = new Web3(window.ethereum);
        try {
          // Request account access if needed
          await window.ethereum.enable();
          // Acccounts now exposed
          results = {
            web3Instance: web3,
            web3Provider: web3.currentProvider,
            web3Fallback,
            providerFallback,
          }
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }
      // Legacy dapp browsers...
      else if (window.web3) {
        // Use Mist/MetaMask's provider.
        const web3 = window.web3;
        results = {
          web3Instance: web3,
          web3Provider: web3.currentProvider,
          web3Fallback,
          providerFallback,
        }
        console.log("Injected web3 detected.");
        resolve(results);
    } else {
      // Fallback to localhost if no web3 injection. We've configured this to
      // use the development console's port by default.
      let provider = new HttpProvider('http://localhost:8545');
      //var provider = new Web3.providers.HttpProvider('http://localhost:8545')

      const web3 = new Web3(provider)

      results = {
        web3Instance: web3,
        web3Provider: provider,
        web3Fallback,
        providerFallback,
      }
      console.log('No web3 instance injected, using Local web3.');
      resolve(results)
    }
  })
})

export default getWeb3
