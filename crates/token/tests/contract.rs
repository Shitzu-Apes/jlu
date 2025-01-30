mod util;

use near_sdk::json_types::U128;

pub use crate::util::*;

#[tokio::test]
async fn test_token_migration() -> anyhow::Result<()> {
    let Init {
        owner,
        jlu_old,
        jlu,
        ..
    } = initialize_contracts().await?;

    call::storage_deposit(jlu_old.id(), jlu.as_account(), None, None).await?;

    call::mint_tokens(&jlu_old, owner.id(), 1_000_000).await?;

    let balance = view::ft_balance_of(&owner, jlu_old.id()).await?;
    assert_eq!(balance, U128::from(1_000_000));

    let (_, events) = call::ft_transfer_call(
        &owner,
        jlu_old.id(),
        jlu.id(),
        U128::from(1_000_000),
        "".to_string(),
    )
    .await?;

    let balance = view::ft_balance_of(&owner, jlu_old.id()).await?;
    assert_eq!(balance, U128(0));
    let balance = view::ft_balance_of(&owner, jlu.id()).await?;
    assert_eq!(balance, U128(1_000_000));
    let balance = view::ft_balance_of(jlu.as_account(), jlu_old.id()).await?;
    assert_eq!(balance, U128(1_000_000));

    assert_ft_mint_events(
        &events,
        vec![FtMint {
            owner_id: owner.id().clone(),
            amount: U128::from(1_000_000),
            memo: None,
        }],
    )?;

    Ok(())
}
