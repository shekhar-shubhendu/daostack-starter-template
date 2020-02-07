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
  
  const GenericScheme = require('@daostack/arc/build/contracts/GenericScheme.json');
  const GenesisProtocol = require('@daostack/arc/build/contracts/GenesisProtocol.json');
  const SignalScheme = require('../../abis/0.0.1-rc.31/NewSignalScheme.json')
  const contract = require("@truffle/contract")
  const devtest = require('../../daos/private/devtest.json')
  const Reputation = require('@daostack/arc/build/contracts/Reputation.json');

  const Web3 = require('web3');
  const maintest = async (web3, opts, proposalIPFSData, matchto) => {
    const accounts = web3.eth.accounts.wallet;
  
    const genericScheme = new web3.eth.Contract(
      GenericScheme.abi,
      devtest.Schemes[0].address,
      opts,
    );
    const ReputationContract =  contract({
      abi: Reputation.abi
    })
    ReputationContract.setProvider(new Web3.providers.HttpProvider("http://localhost:8545"))
    ReputationContract.defaults({
      from: accounts[0].address
    })
    const reputation_deployed = await ReputationContract.at(devtest.Reputation)
    const GenericSchemeContract =  contract({
      abi: GenericScheme.abi
    })
    GenericSchemeContract.setProvider(new Web3.providers.HttpProvider("http://localhost:8545"))
    GenericSchemeContract.defaults({
      from: accounts[0].address
    })
    const generic_deployed = await GenericSchemeContract.at(devtest.Schemes[0].address)
    
    const genesisProtocol = new web3.eth.Contract(
      GenesisProtocol.abi,
      '0x52538ef9Bf93187C0AcdCddA27610d0f81A17227',
      opts,
    );
  
    const signalSchemeMock = new web3.eth.Contract(
      SignalScheme.abi,
      '0xf0EC0F1D6B72e8ea59981612A60fe09F08C45A5F',
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
      const { blockNumber } = await prop.send({from: accounts[8].address, gas: 5000000 });
      const { timestamp } = await web3.eth.getBlock(blockNumber);
      return { proposalId, timestamp };
    }
  
    const [PASS, FAIL] = [1, 2];
    async function vote({ proposalId, outcome, voter, amount = 0 }) {
      let voter_rep = await reputation_deployed.balanceOf(voter)
      console.log('Voter: ', voter, ' Reputation Balance Before Vote: ', voter_rep.toString())
      const { blockNumber } = await genesisProtocol.methods.vote(proposalId, outcome, amount, voter)
        .send({ from: voter, gas: 5000000 });
      const { timestamp } = await web3.eth.getBlock(blockNumber);
      voter_rep = await reputation_deployed.balanceOf(voter)
      console.log('Voter: ', voter, ' Reputation Balance After Vote: ', voter_rep.toString())
      return timestamp;
    }

    async function execute({ proposalId, sender}) {
      const data = await generic_deployed.execute(new String(proposalId).valueOf())
      /* const data = await propExecute.send(); */
      console.log('Execute Result: ', JSON.stringify(data)) 
      const { timestamp } = await web3.eth.getBlock(data.blockNumber);
      return timestamp;
    }

    const { proposalId: p1, timestamp: p1Creation } = await propose();
    console.log('Proposal id:', new String(p1).valueOf())

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
  
  
    let proposal = (await sendQuery(getProposal,20000)).proposal;
    expect(proposal).toMatchObject({
      id: p1,
      descriptionHash: descHash,
      stage: 'Queued',
      createdAt: p1Creation.toString(),
      executedAt: null,
  
      genericScheme: {
        id: p1,
        dao: {
          id: devtest.Avatar,
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

    console.log("Get Proposal before voting")

    let data = await generic_deployed.organizationProposals(p1)

    console.log("Proposal: ", data)

    console.log("Voting starts....")

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

    let executedAt = await vote({
      proposalId: p1,
      outcome: PASS,
      amount: 0,
      voter: accounts[2].address
    });

    console.log("Proposal after 3 votes")
    data = await generic_deployed.organizationProposals(p1)
    console.log("Proposal: ", data)

    console.log("increasing time....")
    await increaseTime(5 * 1000, web3);
    
    console.log('Casting 3rd vote.....')
    /* let executedAt = await vote({
      proposalId: p1,
      outcome: PASS,
      amount: 0,
      voter: accounts[3].address
    }); */

    console.log("last vote executed at ", executedAt)
    console.log("Get Proposal after voting ends....")

    data = await generic_deployed.organizationProposals(p1)

    console.log("Proposal: ", data)

    await execute({proposalId: p1, sender: accounts[0].address})

    data = await generic_deployed.organizationProposals(p1)

    console.log("Proposal: ", data)
  
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
          id: devtest.Avatar,
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
    let opts;
  
    beforeAll(async () => {
      web3 = await getWeb3();
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
  
      const test = await maintest(web3, opts,proposalIPFSData, matchto)
  
  
    }, 100000);
  
  });