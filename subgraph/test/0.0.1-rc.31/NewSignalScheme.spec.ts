import {
    getContractAddresses,
    getOptions,
    getWeb3,
    sendQuery,
    waitUntilTrue,
    writeProposalIPFS,
    increaseTime
  } from './util';

  jest.setTimeout(30000);
  
  const ActionMock = require('@daostack/arc/build/contracts/ActionMock.json');
  const GenericScheme = require('@daostack/arc/build/contracts/GenericScheme.json');
  const GenesisProtocol = require('@daostack/arc/build/contracts/GenesisProtocol.json');
  const SignalScheme = require('../../../build/contracts/SignalScheme.json')
  const contract = require("@truffle/contract")
  const Web3 = require('web3');
  const maintest = async (web3, addresses, opts, proposalIPFSData, matchto) => {
    const accounts = web3.eth.accounts.wallet;
  
    const genericScheme = new web3.eth.Contract(
      GenericScheme.abi,
      '0xd0cC95aeC378CCc0E2626fd2519e24E7B76087b9',
      opts,
    );

    const GenericSchemeContract =  contract({
      abi: GenericScheme.abi
    })
    GenericSchemeContract.setProvider(new Web3.providers.HttpProvider("http://localhost:8545"))
    GenericSchemeContract.defaults({
      from: accounts[0].address
    })
    const deployed = await GenericSchemeContract.at('0xd0cC95aeC378CCc0E2626fd2519e24E7B76087b9')
    
    const genesisProtocol = new web3.eth.Contract(
      GenesisProtocol.abi,
      '0xe708F1E0Ca12d21adB823062e34f1bb5A79DD979',
      opts,
    );
  
    const signalSchemeMock = new web3.eth.Contract(
      SignalScheme.abi,
      '0x75E835582B2Cc4aa79fA50f2a42285EbEdF305b3',
      opts,
    );
  
    let proposalDescription = proposalIPFSData.description;
    let proposalTitle = proposalIPFSData.title;
    let proposalUrl = proposalIPFSData.url;
  
    let descHash = await writeProposalIPFS(proposalIPFSData);
    let callData = await signalSchemeMock.methods.signal(descHash).encodeABI();

    console.log(descHash, callData)

    async function propose() {
      const prop = genericScheme.methods.proposeCall(callData, 1, descHash);
      const proposalId = await prop.call();
      const { blockNumber } = await prop.send({ from: accounts[8].address, gas: 5000000});
      const { timestamp } = await web3.eth.getBlock(blockNumber);
      return { proposalId, timestamp };
    }
  
    const [PASS, FAIL] = [1, 2];
    async function vote({ proposalId, outcome, voter, amount = 0 }) {
      const { blockNumber } = await genesisProtocol.methods.vote(proposalId, 1, amount, voter)
        .send({ from: voter });
      const { timestamp } = await web3.eth.getBlock(blockNumber);
      return timestamp;
    }

    async function execute({ proposalId, sender}) {
      const { blockNumber } = await genericScheme.methods.execute(proposalId).send()
      const { timestamp } = await web3.eth.getBlock(blockNumber);
      return timestamp;
    }
  
    const { proposalId: p1, timestamp: p1Creation } = await propose();
    console.log(p1)
    const getProposal = `{
      proposal(id: "${p1}") {
          id
          descriptionHash
          stage
          createdAt
          executedAt
  
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
  
  
    let proposal = (await sendQuery(getProposal,80000)).proposal;
    expect(proposal).toMatchObject({
      id: p1,
      descriptionHash: descHash,
      stage: 'Queued',
      createdAt: p1Creation.toString(),
      executedAt: null,
  
      genericScheme: {
        id: p1,
        dao: {
          id: '0xb6a1a719bf89eb180bbd242914f30b874170e564',
        },
        contractToCall: signalSchemeMock.options.address.toLowerCase(),
        callData,
        value: '1',
        executed: false,
        returnValue: null,
      },
      scheme: {
        genericSchemeParams: {
          contractToCall: signalSchemeMock.options.address.toLowerCase(),
        },
      },
    });

    console.log("get data from contract")

    let data = await deployed.organizationProposals(p1)

    console.log("Data: ", data)

    console.log("vote with null address")

    await vote({
      proposalId: p1,
      outcome: PASS,
      voter: accounts[1].address
    });

    console.log("increasing time....")
    await increaseTime(5 * 1000, web3);

    console.log("calling execute....")
    let executedAt = await execute({proposalId: p1, sender: accounts[0].address})

    console.log("after voting")
    console.log("get data from contract")

    data = await deployed.organizationProposals(p1)

    console.log("Data: ", data)
  
    const executedIsIndexed = async () => {
      return (await sendQuery(getProposal)).proposal.executedAt != null;
    };
  
    await waitUntilTrue(executedIsIndexed);
  
    proposal = (await sendQuery(getProposal)).proposal;
    expect(proposal).toMatchObject({
      id: p1,
      descriptionHash: descHash,
      stage: 'Executed',
      createdAt: p1Creation.toString(),
      executedAt: executedAt + '',
  
      genericScheme: {
        id: p1,
        dao: {
          id: '0xb6a1a719bf89eb180bbd242914f30b874170e564',
        },
        contractToCall: signalSchemeMock.options.address.toLowerCase(),
        callData,
        value: '0',
        executed: true,
        returnValue: '0x0000000000000000000000000000000000000000000000000000000000000001',
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
    let addresses;
    let opts;
  
    beforeAll(async () => {
      web3 = await getWeb3();
      addresses = getContractAddresses();
      opts = await getOptions(web3);
    });
  
    it('generic scheme proposal generate ', async () => {
  
      let proposalIPFSData = {
        description: 'Setting new header Image',
        title: 'New Header Image',
        url: 'http://swift.org/modest',
        key: 'Header',
        value: 'https://de.wikipedia.org/wiki/Wald#/media/Datei:Laurisilva_en_el_Cubo_de_la_Galga.jpg',
      };
  
      let matchto = {
        signals:[
           {
             data:
               '{"Header":"https://de.wikipedia.org/wiki/Wald#/media/Datei:Laurisilva_en_el_Cubo_de_la_Galga.jpg"}',
             id:
               '0x86e9fe552e75e4fc51f46e4efc128628ecd5ada7'
           }
         ]
      }
  
      const test = await maintest(web3, addresses, opts,proposalIPFSData, matchto)
  
  
    }, 200000);
  
  });