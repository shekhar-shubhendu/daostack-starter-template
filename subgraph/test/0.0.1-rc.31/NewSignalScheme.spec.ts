import {
  getOptions,
  getWeb3,
  sendQuery,
  waitUntilTrue,
  writeProposalIPFS
} from './util';

jest.setTimeout(30000);

const GenericScheme = require('@daostack/arc/build/contracts/GenericScheme.json');
const GenesisProtocol = require('@daostack/arc/build/contracts/GenesisProtocol.json');
const SignalScheme = require('./SignalScheme.json')
const contract = require("@truffle/contract")
const devtest = require('../../daos/private/devtest.json')

const Web3 = require('web3');
const maintest = async (web3, opts, proposalIPFSData, matchto) => {
  const accounts = web3.eth.accounts.wallet;

  const genericScheme = new web3.eth.Contract(
    GenericScheme.abi,
    devtest.Schemes[0].address,
    opts,
  );

  const GenericSchemeContract = contract({
    abi: GenericScheme.abi
  })
  GenericSchemeContract.setProvider(new Web3.providers.HttpProvider("http://localhost:8545"))
  GenericSchemeContract.defaults({
    from: accounts[0].address
  })

  const genesisProtocol = new web3.eth.Contract(
    GenesisProtocol.abi,
    '0x72D9Ca808747b01e97c38C9Fc95E99FdC0a8Ab1b',
    opts,
  );

  const signalSchemeMock = new web3.eth.Contract(
    SignalScheme.abi,
    '0xee471EBA284bFE824AE0dee31049829A5860aC0A',
    opts,
  );
  
  let descHash = await writeProposalIPFS(proposalIPFSData);
  let callData = await signalSchemeMock.methods.signal(descHash).encodeABI();

  async function propose() {
    const prop = genericScheme.methods.proposeCall(callData, 0, descHash);
    const proposalId = await prop.call();
    const { blockNumber } = await prop.send({ from: accounts[8].address, gas: 5000000 });
    const { timestamp } = await web3.eth.getBlock(blockNumber);
    return { proposalId, timestamp };
  }

  const [PASS, FAIL] = [1, 2];
  async function vote({ proposalId, outcome, voter, amount = 0 }) {
    const { blockNumber } = await genesisProtocol.methods.vote(proposalId, outcome, amount, voter)
      .send({ from: voter, gas: 5000000 });
    const { timestamp } = await web3.eth.getBlock(blockNumber);
    return timestamp;
  }

  const { proposalId: p1, timestamp: p1Creation } = await propose();
  console.log('Proposal id:', new String(p1).valueOf())

  const getProposal = `{
      proposal(id: "${p1}") {
          id
          descriptionHash
          createdAt
          genericScheme {
            id
            dao {
               id
            }
            contractToCall
            callData
            value
            executed
            returnValue
          }
          scheme {
            genericSchemeParams {
              contractToCall
            }
          }
      }
  }`;


  let proposal = (await sendQuery(getProposal, 20000)).proposal;
  expect(proposal).toMatchObject({
    id: p1,
    descriptionHash: descHash,
    createdAt: p1Creation.toString(),
    genericScheme: {
      id: p1,
      dao: {
        id: devtest.Avatar.toLowerCase(),
      },
      contractToCall: signalSchemeMock.options.address.toLowerCase(),
      callData,
      value: "0",
      executed: false,
      returnValue: null,
    },
    scheme: {
      genericSchemeParams: {
        contractToCall: signalSchemeMock.options.address.toLowerCase(),
      },
    },
  });

  await vote({
    proposalId: p1,
    outcome: PASS,
    amount: 0,
    voter: accounts[0].address
  });

  await vote({
    proposalId: p1,
    outcome: PASS,
    amount: 0,
    voter: accounts[1].address
  });

  await vote({
    proposalId: p1,
    outcome: PASS,
    amount: 0,
    voter: accounts[2].address
  });

  const executedIsIndexed = async () => {
    return (await sendQuery(getProposal)).proposal.genericScheme.executed == true;
  };

  await waitUntilTrue(executedIsIndexed);

  proposal = (await sendQuery(getProposal)).proposal;
  expect(proposal).toMatchObject({
    id: p1,
    descriptionHash: descHash,
    createdAt: p1Creation.toString(),
    genericScheme: {
      id: p1,
      dao: {
        id: devtest.Avatar.toLowerCase(),
      },
      contractToCall: signalSchemeMock.options.address.toLowerCase(),
      callData,
      value: '0',
      executed: true,
      returnValue: '0x',
    },
  });

  const metaq = `{
      signals{
        id
        data
      }
    }`

  const metadata = await sendQuery(metaq, 15000);
  expect(metadata).toMatchObject(matchto);

}

describe('Generic Signal Scheme', () => {
  let web3;
  let opts;

  beforeAll(async () => {
    web3 = await getWeb3();
    opts = await getOptions(web3);
  });

  it('generic scheme proposal generate', async () => {

    let proposalIPFSData = {
      description: 'Setting new header Image',
      title: 'New Header Image',
      url: 'http://swift.org/modest',
      key: 'Header',
      value: 'https://de.wikipedia.org/wiki/Wald#/media/Datei:Laurisilva_en_el_Cubo_de_la_Galga.jpg',
    };

    let matchto = {
      signals: [
        {
          data: '{"Header":"https://de.wikipedia.org/wiki/Wald#/media/Datei:Laurisilva_en_el_Cubo_de_la_Galga.jpg"}',
          id: devtest.Avatar.toLowerCase()
        }
      ]
    }

    await maintest(web3, opts, proposalIPFSData, matchto)


  }, 100000);

});