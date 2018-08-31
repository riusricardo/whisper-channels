### :warning: Whisper is an experimental technology. :warning:

# whisper-channels
Decentralized bidirectional communication protocol layer. Exchanging Ethereum Whisper asymetric public keys on the Ethr DID registry.

### Requirements
* Unix system.
* Geth 1.8 and up
* Truffle Framework
* NodeJs
* Yarn

## Usage
(yarn or npm)
### Terminal 1
```sh
yarn install
yarn run geth-dev
```
### Terminal 2
```sh
yarn run geth-dev-unlock
truffle compile
truffle migrate --network geth_dev
yarn start
```
