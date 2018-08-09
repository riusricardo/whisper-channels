var DidRegistryContract = artifacts.require("EthereumDIDRegistry");
//var Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer) {
  deployer.deploy(DidRegistryContract);
};
