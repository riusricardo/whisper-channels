var DidRegistryContract = artifacts.require("EthereumDIDRegistry");

module.exports = function(deployer) {
  deployer.deploy(DidRegistryContract);
};
