# Regras da Calculadora de Descontos

Este diretório contém as regras de negócio que definem como os descontos são calculados.

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `disponibilidade.md` | Regras baseadas em dias disponíveis sem reserva |
| `demanda.md` | Regras baseadas na demanda de busca do PriceLabs |
| `repasse.md` | Regras de proteção do valor mínimo de repasse ao proprietário |
| `combinadas.md` | Regras que combinam múltiplos fatores |

## Como funciona

Cada arquivo define condições e o desconto máximo permitido para aquela condição.
A calculadora lê todos os arquivos e aplica as regras em ordem de prioridade.
O desconto final é o menor valor entre todas as regras que se aplicam (proteção ao proprietário).
