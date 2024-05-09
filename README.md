# Geoglify

Welcome to Geoglify, an innovative open-source project dedicated to exploring the vast realm of ships, maritime data, planning, and related statistics. Explore a universe of geospatial tools and resources crafted to unlock the mysteries of the maritime domain.

![geoglify](https://github.com/geoglify/geoglify/assets/4217810/05b30701-a8cd-4e6a-8cd3-b150621b4a9a)

## Objective

The primary goal of Geoglify is to provide a centralized platform for the analysis and visualization of data related to the sea. We aim to offer valuable insights into the shipping industry, maritime planning, and associated statistics, promoting a comprehensive understanding of the marine environment.

![Captura de ecrã 2024-02-03 171218](https://github.com/geoglify/geoglify/assets/4217810/a0fea097-cf8a-4281-b04f-e6e2f9e742a0)

## How to Contribute

We welcome contributions from the community! If you're interested in contributing to the development of Geoglify, follow these steps:

1. Fork this repository.
2. Clone the forked repository to your local machine.
3. Create a branch for your contribution: `git checkout -b my-contribution`.
4. Make the desired changes and commit them: `git commit -m 'Add feature X'`.
5. Push to your branch: `git push origin my-contribution`.
6. Open a pull request for review.

## Environment Setup

To set up the development environment, follow the instructions in the [`INSTALL.md`](INSTALL.md) file.

## License

This project is licensed under the [MIT License](LICENSE) - see the file for details.

Take a look at our code and explore the vast world of Geoglify! We look forward to community contributions and making this project a go-to resource for maritime data analysis and planning in the industry.



mongodb express
docker run --link webmongo:mongodb -p 8083:8081 -e ME_CONFIG_MONGODB_URL="mongodb://mongodb:27778" mongo-express

docker run --network geoglify_default --link mongodb:mongodb -p 8083:8081 -e ME_CONFIG_MONGODB_URL="mongodb://mongodb:27778" mongo-express