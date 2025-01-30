use super::log_view_result;
use near_contract_standards::fungible_token::metadata::FungibleTokenMetadata;
use near_sdk::json_types::U128;
use near_workspaces::{network::Sandbox, Account, AccountId, Contract, Worker};

pub async fn ft_balance_of(sender: &Account, token_id: &AccountId) -> anyhow::Result<U128> {
    let res = log_view_result(
        sender
            .call(token_id, "ft_balance_of")
            .args_json((sender.id(),))
            .max_gas()
            .view()
            .await?,
    )?;
    Ok(res.json()?)
}

pub async fn ft_total_supply(contract: &Contract) -> anyhow::Result<U128> {
    let res = log_view_result(contract.call("ft_total_supply").max_gas().view().await?)?;
    Ok(res.json()?)
}

pub async fn ft_metadata(
    worker: &Worker<Sandbox>,
    token_id: &AccountId,
) -> anyhow::Result<FungibleTokenMetadata> {
    let res = log_view_result(worker.view(token_id, "ft_metadata").await?)?;
    Ok(res.json()?)
}
