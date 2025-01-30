use near_sdk::{
    json_types::U128,
    serde::{Deserialize, Serialize},
    AccountId,
};
use owo_colors::OwoColorize;
use std::fmt::{self, Display, Formatter};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
#[serde(tag = "standard")]
#[serde(rename_all = "kebab-case")]
pub enum ContractEvent {
    Nep141(Nep141Event),
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Nep141Event {
    pub version: String,
    #[serde(flatten)]
    pub event_kind: Nep141EventKind,
}

#[allow(clippy::enum_variant_names)]
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum Nep141EventKind {
    FtTransfer(Vec<FtTransfer>),
    FtMint(Vec<FtMint>),
    FtBurn(Vec<FtBurn>),
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct FtTransfer {
    pub old_owner_id: String,
    pub new_owner_id: String,
    pub amount: String,
    pub memo: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct FtMint {
    pub owner_id: AccountId,
    pub amount: U128,
    pub memo: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct FtBurn {
    pub owner_id: AccountId,
    pub amount: U128,
    pub memo: Option<String>,
}

impl Display for ContractEvent {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            ContractEvent::Nep141(event) => formatter.write_fmt(format_args!("{}", event)),
        }
    }
}

impl Display for Nep141Event {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match &self.event_kind {
            Nep141EventKind::FtTransfer(_) => {
                formatter.write_fmt(format_args!("{}: ft_transfer", "event".bright_cyan()))?;
            }
            Nep141EventKind::FtMint(_) => {
                formatter.write_fmt(format_args!("{}: ft_mint", "event".bright_cyan()))?;
            }
            Nep141EventKind::FtBurn(_) => {
                formatter.write_fmt(format_args!("{}: ft_burn", "event".bright_cyan()))?;
            }
        }
        formatter.write_fmt(format_args!("\n{}: nep141", "standard".bright_cyan(),))?;
        formatter.write_fmt(format_args!(
            "\n{}: {}",
            "version".bright_cyan(),
            self.version
        ))?;
        match &self.event_kind {
            Nep141EventKind::FtTransfer(datas) => {
                for data in datas {
                    formatter.write_fmt(format_args!("\n{}: {}", "data".bright_cyan(), data))?;
                }
            }
            Nep141EventKind::FtMint(datas) => {
                for data in datas {
                    formatter.write_fmt(format_args!("\n{}: {}", "data".bright_cyan(), data))?;
                }
            }
            Nep141EventKind::FtBurn(datas) => {
                for data in datas {
                    formatter.write_fmt(format_args!("\n{}: {}", "data".bright_cyan(), data))?;
                }
            }
        }
        Ok(())
    }
}

impl Display for FtTransfer {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        if let Some(memo) = &self.memo {
            formatter.write_fmt(format_args!(
                "{} --> {} ({}) --> {}",
                self.old_owner_id.bright_blue(),
                self.amount.bright_blue(),
                memo,
                self.new_owner_id.bright_blue(),
            ))?;
        } else {
            formatter.write_fmt(format_args!(
                "{} --> {} --> {}",
                self.old_owner_id.bright_blue(),
                self.amount.bright_blue(),
                self.new_owner_id.bright_blue(),
            ))?;
        }
        Ok(())
    }
}

impl Display for FtMint {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        if let Some(memo) = &self.memo {
            formatter.write_fmt(format_args!(
                "{} ({}) --> {}",
                self.amount.0.bright_blue(),
                memo,
                self.owner_id.bright_blue(),
            ))?;
        } else {
            formatter.write_fmt(format_args!(
                "{} --> {}",
                self.amount.0.bright_blue(),
                self.owner_id.bright_blue(),
            ))?;
        }
        Ok(())
    }
}

impl Display for FtBurn {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        if let Some(memo) = &self.memo {
            formatter.write_fmt(format_args!(
                "{} --> {} ({}) 🔥",
                self.owner_id.bright_blue(),
                self.amount.0.bright_blue(),
                memo,
            ))?;
        } else {
            formatter.write_fmt(format_args!(
                "{} --> {} 🔥",
                self.owner_id.bright_blue(),
                self.amount.0.bright_blue(),
            ))?;
        }
        Ok(())
    }
}
