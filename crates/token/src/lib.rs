mod core;
mod storage;

use near_contract_standards::fungible_token::{
    events::{FtBurn, FtMint},
    metadata::{FungibleTokenMetadata, FungibleTokenMetadataProvider},
    receiver::FungibleTokenReceiver,
    FungibleToken, FungibleTokenResolver,
};
use near_sdk::{
    borsh::{BorshDeserialize, BorshSerialize},
    env,
    json_types::U128,
    near_bindgen, require, AccountId, BorshStorageKey, PanicOnDefault, Promise, PromiseOrValue,
};

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Token,
}

#[near_bindgen(contract_metadata(
    standard(standard = "nep141", version = "1.0.0"),
    standard(standard = "nep145", version = "1.0.0"),
    standard(standard = "nep148", version = "1.0.0")
))]
#[derive(BorshSerialize, BorshDeserialize, PanicOnDefault)]
#[borsh(crate = "near_sdk::borsh")]
pub struct Contract {
    owner: AccountId,
    migrate_address: AccountId,
    token: FungibleToken,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner: AccountId, migrate_address: AccountId) -> Self {
        Self {
            owner,
            migrate_address,
            token: FungibleToken::new(StorageKey::Token),
        }
    }

    pub fn migrate(&mut self) {
        // empty for now
    }

    pub fn upgrade(&self) -> Promise {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only account owner can update the code"
        );

        let code = env::input().expect("Error: No input").to_vec();

        Promise::new(env::current_account_id())
            .deploy_contract(code)
            .then(Self::ext(env::current_account_id()).migrate())
            .as_return()
    }
}

#[near_bindgen]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used_amount, burned_amount) =
            self.token
                .internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned_amount > 0 {
            FtBurn {
                owner_id: &sender_id,
                amount: burned_amount.into(),
                memo: None,
            }
            .emit();
        }
        used_amount.into()
    }
}

#[near_bindgen]
impl FungibleTokenReceiver for Contract {
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        #[allow(unused_variables)] msg: String,
    ) -> PromiseOrValue<U128> {
        if env::predecessor_account_id() == self.migrate_address {
            if !self.token.accounts.contains_key(&sender_id) {
                self.token.internal_register_account(&sender_id);
            }
            self.token.internal_deposit(&sender_id, amount.into());
            FtMint {
                owner_id: &sender_id,
                amount,
                memo: None,
            }
            .emit();
            PromiseOrValue::Value(0.into())
        } else {
            PromiseOrValue::Value(amount)
        }
    }
}

#[near_bindgen]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: "ft-1.0.0".to_string(),
            name: "JLU".to_string(),
            symbol: "JLU".to_string(),
            icon: Some(ICON.to_string()),
            reference: None,
            reference_hash: None,
            decimals: 18,
        }
    }
}

const ICON: &str = "data:image/webp;base64,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";
