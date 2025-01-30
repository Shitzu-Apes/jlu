pub mod call;
mod event;
pub mod view;

pub use event::*;

use crate::*;
use near_sdk::{
    serde::Serialize,
    serde_json::{self, json},
};
use near_workspaces::{
    network::Sandbox,
    result::{ExecutionFinalResult, ExecutionResult, Value, ViewResultDetails},
    types::NearToken,
    Account, Contract, Worker,
};
use owo_colors::OwoColorize;
use std::fmt;
use tokio::fs;

#[macro_export]
macro_rules! print_log {
    ( $x:expr, $($y:expr),+ ) => {
        let thread_name = std::thread::current().name().unwrap().to_string();
        if thread_name == "main" {
            println!($x, $($y),+);
        } else {
            let mut s = format!($x, $($y),+);
            s = s.split('\n').map(|s| {
                let mut pre = "    ".to_string();
                pre.push_str(s);
                pre.push('\n');
                pre
            }).collect::<String>();
            println!(
                "{}\n{}",
                thread_name.bold(),
                &s[..s.len() - 1],
            );
        }
    };
}

#[allow(unused)]
pub struct Init {
    pub worker: Worker<Sandbox>,
    pub owner: Account,
    pub jlu_old: Contract,
    pub jlu: Contract,
}

pub async fn initialize_contracts() -> anyhow::Result<Init> {
    let worker = near_workspaces::sandbox().await?;

    let owner = worker.dev_create_account().await?;

    let wasm = fs::read("../../res/test_token.wasm").await?;
    let jlu_old = worker.dev_deploy(wasm.as_slice()).await?;
    jlu_old
        .call("new")
        .args_json(("JLUv1", "JLU", None::<String>, 18))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    jlu_old
        .call("storage_deposit")
        .args_json((owner.id(), true))
        .max_gas()
        .deposit(NearToken::from_millinear(100))
        .transact()
        .await?
        .into_result()?;

    let wasm = fs::read("../../res/token.wasm").await?;
    let jlu = worker.dev_deploy(wasm.as_slice()).await?;
    jlu.call("new")
        .args_json((owner.id(), jlu_old.id()))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    Ok(Init {
        worker,
        owner,
        jlu_old,
        jlu,
    })
}

pub async fn initialize_token(
    worker: &Worker<Sandbox>,
    name: &str,
    ticker: &str,
    icon: Option<&str>,
    decimals: u8,
) -> anyhow::Result<Contract> {
    let token_contract = worker
        .dev_deploy(&fs::read("../../res/test_token.wasm").await?)
        .await?;
    token_contract
        .call("new")
        .args_json((name, ticker, icon, decimals))
        .transact()
        .await?
        .into_result()?;

    Ok(token_contract)
}

pub fn assert_ft_mint_events<T>(actual: &T, events: Vec<FtMint>) -> anyhow::Result<()>
where
    T: Serialize + fmt::Debug + Clone,
{
    let mut actual = serde_json::to_value(actual)?;
    actual.as_array_mut().unwrap().retain(|ac| {
        let event_str = ac
            .as_object()
            .unwrap()
            .get("event")
            .unwrap()
            .as_str()
            .unwrap();
        event_str == "ft_mint"
    });
    let mut expected = vec![];
    for event in events {
        expected.push(json!({
            "event": "ft_mint",
            "standard": "nep141",
            "version": "1.0.0",
            "data": [event]
        }));
    }
    assert_eq!(
        &actual,
        &serde_json::to_value(&expected)?,
        "actual and expected events did not match.\nActual: {:#?}\nExpected: {:#?}",
        &actual,
        &expected
    );
    Ok(())
}

pub fn log_tx_result(
    ident: &str,
    res: ExecutionFinalResult,
) -> anyhow::Result<(ExecutionResult<Value>, Vec<ContractEvent>)> {
    for failure in res.receipt_failures() {
        print_log!("{:#?}", failure.bright_red());
    }
    let mut events = vec![];
    for outcome in res.receipt_outcomes() {
        if !outcome.logs.is_empty() {
            for log in outcome.logs.iter() {
                if log.starts_with("EVENT_JSON:") {
                    if let Ok(event) =
                        serde_json::from_str::<ContractEvent>(&log.replace("EVENT_JSON:", ""))
                    {
                        events.push(event.clone());
                        print_log!(
                            "{}: {}\n{}",
                            "account".bright_cyan(),
                            outcome.executor_id,
                            event
                        );
                    }
                } else {
                    print_log!("{}", log.bright_yellow());
                }
            }
        }
    }
    print_log!(
        "{} gas burnt: {:.3} {}",
        ident.italic(),
        res.total_gas_burnt.as_tgas().bright_magenta().bold(),
        "TGas".bright_magenta().bold()
    );
    Ok((res.into_result()?, events))
}

pub fn log_view_result(res: ViewResultDetails) -> anyhow::Result<ViewResultDetails> {
    if !res.logs.is_empty() {
        for log in res.logs.iter() {
            print_log!("{}", log.bright_yellow());
        }
    }
    Ok(res)
}
