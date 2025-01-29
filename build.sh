#!/bin/bash
set -e
cd "`dirname $0`"

cargo near build reproducible-wasm --manifest-path crates/token/Cargo.toml
cargo near abi --manifest-path crates/token/Cargo.toml
cp target/near/token/token.wasm ./res/
cp target/near/token/token_abi.json ./res/
