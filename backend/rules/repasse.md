# Regras de Proteção do Repasse ao Proprietário

O desconto nunca pode fazer o valor de repasse ao proprietário cair abaixo do mínimo definido.

## Regras

- O repasse mínimo é calculado como: `valor_base_repasse * (1 - margem_operacional)`
- A margem operacional padrão da WeCare é definida por imóvel no Hostaway
- O desconto máximo permitido por esta regra é: `1 - (repasse_minimo / diaria_atual)`

## Campos do Hostaway utilizados

- `baseAmount` — valor base da diária
- `hostAmount` — valor de repasse ao proprietário
- `cleaningFee` — taxa de limpeza (não entra no desconto)
- `channelFee` — taxa do canal (não entra no desconto)

## Observação

Esta regra tem **prioridade máxima**. Nenhum desconto pode violar o repasse mínimo.
