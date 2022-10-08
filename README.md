# Vǫrðr 👻👀⚡️

A monitoring application for THORNodes.

> A Vǫrðr or warden is a guardian spirit who will follow the soul of a living person from birth until death.

## Supported Chains

All chains are monitored for `Health`, `Sync Status` and `Version` once per minute.

| Client   | Chain                                                              |
|----------|--------------------------------------------------------------------|
| Bitcoin  | Bitcoin (BTC), Litecoin (LTC), Bitcoin Cash (BCH), Dogecoin (DOGE) |
| Ethereum | Ethereum (ETH), Avalanche (AVAX)                                   |
| Cosmos   | Cosmos (ATOM), Binance (BNB), THORChain (RUNE)                     |

## Local Environment

### Installation

Install all the required dependencies from `package.json`:

```
yarn install
```

### Build

Compile `.ts` to `.js`:

```
yarn build
```

### Environment Variables

| Key                  | Required | Description                                                            |
|----------------------|----------|------------------------------------------------------------------------|
| NODE_ENV             | No       | Set to `production`, if you want to run the application in production. |
| BETTERUPTIME_API_KEY | Yes      | BetterUptime's API Key, see [here](#betteruptime).                     |
| LOGTAIL_SOURCE_TOKEN | No       | Logtail's Source Token, see [here](#logging-optional).                 |

### Run

Run via `node.js`:

```
yarn start
```

## Kubernetes

### Deploy to cluster

Set all environment variables in `k8s-deployment.yaml` and deploy the application:

```
kubectl create -f k8s-deployment.yaml
```

### Remove from cluster

Remove the application from the Kubernetes cluster:

```
kubectl delete -f k8s-deployment.yaml
```

## Alerting

### BetterUptime

BetterUptime's `Heartbeats` are used for alerting and incident management.

The application:
- Sends heartbeats once per minute for every node's `Health`, `Sync Status` and `Version`

If BetterUptime does not receive a heartbeat from the application for a certain period of time (`5m` by default), it will notify you and your team based on your escalation policy.

#### API Key

Sign up at [betteruptime.com](https://betteruptime.com/?ref=8l7f) and follow the [docs](https://docs.betteruptime.com/api/getting-started#obtaining-an-api-token) to get the API key.

<img width="1560" alt="image" src="https://user-images.githubusercontent.com/6087393/194463319-da42d277-4c14-49f3-ab86-aaa9cdee412d.png">

## Logging (optional)

Logtail can be optionally used for log manangement.

If `LOGTAIL_SOURCE_TOKEN` is set in the environment variables, the application:
- Send its own logs to Logtail
- Connects to Loki and forwards all logs of the Kubernetes namespace `thornode` to Logtail

Make sure that Loki is installed on your Kubernetes cluster if you want the logs of your nodes to get forwarded (`make install-loki`, see the [docs](https://docs.thorchain.org/thornodes/managing#logs-management-loki)). Forwarded logs can also be queried within the built-in Grafana in Logtail. Read more [here](https://docs.logtail.com/how-to/querying-data-in-logtail#grafana).

#### Source Token

Sign up at [logtail.com](https://logtail.com), go to `Sources`, add a new `Source` with `JavaScript` as the platform and get the `Source` token.

<img width="1516" alt="image" src="https://user-images.githubusercontent.com/6087393/194464966-6d5a1d70-aa4e-4cc6-8bcc-a17549398cc3.png">

## License

```
MIT License

Copyright (c) 2022 Sour Capital Pte. Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
