# Vǫrðr 👻

A monitoring application for THORNodes.

> A Vǫrðr or warden is a guardian spirit who will follow the soul of a living person from birth until death.

## Features

- All chains are monitored for `Health` and `Sync Status` every minute
- THORChain version is monitored every minute
- Kubernetes pod restarts are monitored every 5 minutes
- Kubernetes pod logs of all chains are aggregated
- Slash points are monitored every minute
- Jailing is monitored every minute
- Chain observations are monitored every minute

## Supported Chains

| Client   | Chain                                                              |
|----------|--------------------------------------------------------------------|
| Bitcoin  | Bitcoin (BTC), Litecoin (LTC), Bitcoin Cash (BCH), Dogecoin (DOGE) |
| Ethereum | Ethereum (ETH), Avalanche (AVAX)                                   |
| Cosmos   | Cosmos (ATOM), Binance (BNB), THORChain (RUNE)                     |

## Kubernetes

### Environment Variables

| Key                  | Required | Description                                                            |
|----------------------|----------|------------------------------------------------------------------------|
| THORNODE_ADDRESS     | Yes      | Set to the address of your THORNode (`thor...`).                       |
| BETTERUPTIME_API_KEY | Yes      | BetterUptime's API Key, see [here](#betteruptime).                     |
| LOGTAIL_SOURCE_TOKEN | No       | Logtail's Source Token, see [here](#logging-optional).                 |
| NODE_ENV             | No       | Set to `production`, if you want to run the application in production. |

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

### Run

Run via `node.js`:

```
yarn start
```

## Alerting

### BetterUptime

BetterUptime is used for alerting and incident management.

- Heartbeats are sent every minute for `Health` and `Sync Status` of the nodes
- Missed heartbeats create incidents
- Kubernetes pod restarts create incidents
- High slash points create incidents
- Jailing creates incidents
- Lagging chain observations create incidents
- Outdated THORChain versions creates incidents

#### API Key

Sign up at [betteruptime.com](https://betteruptime.com/?ref=8l7f) and follow the [docs](https://docs.betteruptime.com/api/getting-started#obtaining-an-api-token) to get the API key.

<img width="1560" alt="image" src="https://user-images.githubusercontent.com/6087393/195767124-69095786-69e3-4927-a9ba-5dab0d6958f1.png">

## Logging (optional)

### Logtail

Logtail can be optionally used for log manangement.

If `LOGTAIL_SOURCE_TOKEN` is set in the environment variables:
- Vǫrðr forwards its own logs to Logtail
- Vǫrðr aggregates and forwards the logs of all chains to Logtail

#### Source Token

Sign up at [logtail.com](https://logtail.com), go to `Sources`, add a new `Source` with `JavaScript` as the platform and get the `Source Token`.

<img width="1560" alt="image" src="https://user-images.githubusercontent.com/6087393/195772008-9f6e8708-6ead-4b92-92ff-5a0db7b89384.png">

#### Grafana

Forwarded logs can be queried and analyzed within the built-in Grafana in Logtail. Read more [here](https://docs.logtail.com/how-to/querying-data-in-logtail#grafana).

<img width="1516" alt="image" src="https://user-images.githubusercontent.com/6087393/195779749-3e197654-32e5-4481-96dd-339ed6bea66d.png">

## License

```
MIT License

Copyright (c) 2023 Sour Capital Pte. Ltd.

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
