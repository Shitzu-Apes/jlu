#!/bin/bash
set -e
cd "`dirname $0`"

cargo near build reproducible-wasm --manifest-path crates/token/Cargo.toml
cargo near abi --manifest-path crates/token/Cargo.toml
cargo build --release -p test-token --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/*.wasm ./res/
cp target/near/token/token.wasm ./res/
cp target/near/token/token_abi.json ./res/
