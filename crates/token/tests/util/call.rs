use super::{log_tx_result, ContractEvent};
use near_sdk::{json_types::U128, serde::Serialize, serde_json::json, AccountId, NearToken};
use near_workspaces::{
    result::{ExecutionResult, Value},
    Account, Contract,
};

pub async fn storage_deposit(
    contract_id: &AccountId,
    sender: &Account,
    account_id: Option<&AccountId>,
    deposit: Option<NearToken>,
) -> anyhow::Result<ExecutionResult<Value>> {
    let (res, _) = log_tx_result(
        &format!("{} storage_deposit", contract_id),
        sender
            .call(contract_id, "storage_deposit")
            .args_json((account_id, None::<bool>))
            .deposit(deposit.unwrap_or(NearToken::from_millinear(50)))
            .max_gas()
            .transact()
            .await?,
    )?;
    Ok(res)
}

pub async fn mint_tokens(
    token: &Contract,
    receiver: &AccountId,
    amount: u128,
) -> anyhow::Result<ExecutionResult<Value>> {
    let (res, _) = log_tx_result(
        &format!("{} mint", token.id()),
        token
            .call("mint")
            .args_json((receiver, U128::from(amount)))
            .transact()
            .await?,
    )?;
    Ok(res)
}

pub async fn ft_transfer_call<T: Serialize>(
    sender: &Account,
    token_id: &AccountId,
    receiver_id: &AccountId,
    amount: U128,
    msg: T,
) -> anyhow::Result<(ExecutionResult<Value>, Vec<ContractEvent>)> {
    log_tx_result(
        &format!("{} ft_transfer_call", token_id),
        sender
            .call(token_id, "ft_transfer_call")
            .args_json((
                receiver_id,
                amount,
                Option::<String>::None,
                json!(msg).to_string(),
            ))
            .max_gas()
            .deposit(NearToken::from_yoctonear(1))
            .transact()
            .await?,
    )
}
