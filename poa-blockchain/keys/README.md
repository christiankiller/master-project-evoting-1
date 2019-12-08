# What's in this directory

- `sealerX.json`: key store file generated by MyCrypto. Which is compatible with Parity-Ethereuem. It's basically an encryption of your private key in JSON format which needs a password to unlock. https://download.mycrypto.com/. We need this file in order to tell the new chain that this account already exists. It's not sufficient to only specify an existing address in `config/chain.json`, if we want to use this address as a sealer-node.
- `sealerX.pwd`: this will unlock the account contained in `sealerX.json`. Unfortunately, the password is not easy to remember, because MyCrypto would not allow me to create a wallet with a unsafe password.
- **currently not used** `sealerX.priv.key`: private key of the wallet. Currently not needed anywhere, as the account is unlocked with a password.
- **currently not used** `sealerX.network.key`: this key makes the generation of the `enode` name deterministic (... I think). Meaning that it will always be the same and we can add known `enodes` to the `.toml` file under `[bootnodes]`. So no more need for RPC calls after the chain has started.