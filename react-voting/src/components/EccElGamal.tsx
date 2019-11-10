import React, { useState } from 'react'

import { ECelGamal, Cipher, Summary, ValidVoteProof, SumProof } from 'mp-crypto'
const EC = require('elliptic').ec
const secp256k1 = new EC('secp256k1')

const { Encryption, Voting, VoteZKP } = ECelGamal

const keyPair = secp256k1.genKeyPair()
const sk = keyPair.getPrivate()
const pk = keyPair.getPublic()

// https://codepen.io/code_monk/pen/FvpfI
const randHex = (length: number): string => {
  const maxLength = 4
  const min = Math.pow(16, Math.min(length, maxLength) - 1)
  const max = Math.pow(16, Math.min(length, maxLength)) - 1
  const n = Math.floor(Math.random() * (max - min + 1)) + min
  var r = n.toString(16)
  while (r.length < length) {
    r = r + randHex(length - maxLength)
  }
  return r
}

// used for unique ID's mocking the voters wallet address
const getRandomWalletAddress = () => {
  return '0x' + randHex(32)
}

const getRandomArbitrary = (min: number, max: number) => {
  return Math.random() * (max - min) + min
}

const EccElGamalComponent: React.FC = () => {
  const [voterAddresses, setVoterAddresses] = useState<string[]>([])
  const [votes, setVotes] = useState<Cipher[]>([])
  const [proofs, setProofs] = useState<ValidVoteProof[]>([])
  const [sum, setSum] = useState<Cipher>()
  const [sumProof, setSumProof] = useState<SumProof>()
  const [result, setResult] = useState<number>(0)
  const [summary, setSummary] = useState<Summary>({ total: 0, yes: 0, no: 0 })

  const [publicKey, setPublicKey] = useState<string>(pk.encode('hex', false))
  const [privateKey, setPrivateKey] = useState<typeof sk>(sk)

  const proofParams = {
    p: secp256k1.curve.p, // BN
    n: secp256k1.curve.n, // BN
    g: JSON.stringify(secp256k1.curve.g), // string JSON
    h: publicKey, // string
  }

  const addYesVote = () => {
    const randomWalletAddress = getRandomWalletAddress()

    const vote = Voting.generateYesVote(publicKey)
    const proof = Voting.generateYesProof(vote, proofParams, randomWalletAddress)
    const verifiedProof = Voting.verifyZKP(vote, proof, proofParams, randomWalletAddress)

    if (!verifiedProof) {
      window.alert('Vote Proof Failed!')
      return
    }

    const newVotes = [...votes, vote]
    setVotes(newVotes)
    setProofs([...proofs, proof])
    setVoterAddresses([...voterAddresses, randomWalletAddress])

    // update voting results
    getResult(newVotes)
  }

  const addNoVote = () => {
    const randomWalletAddress = getRandomWalletAddress()

    const vote = Voting.generateNoVote(publicKey)
    const proof = Voting.generateNoProof(vote, proofParams, randomWalletAddress)
    const verifiedProof = Voting.verifyZKP(vote, proof, proofParams, randomWalletAddress)

    if (!verifiedProof) {
      window.alert('Vote Proof Failed!')
      return
    }

    const newVotes = [...votes, vote]
    setVotes(newVotes)
    setProofs([...proofs, proof])
    setVoterAddresses([...voterAddresses, randomWalletAddress])

    // update voting results
    getResult(newVotes)
  }

  const getResult = (votes: any[]) => {
    const sum = Voting.addVotes(votes, publicKey)
    const randomWalletAddress = getRandomWalletAddress()
    const proof = Voting.generateSumProof(sum, proofParams, sk, randomWalletAddress)
    const verifiedProof = Voting.verifySumProof(sum, proof, proofParams, publicKey, randomWalletAddress)

    if (!verifiedProof) {
      window.alert('Sum Proof Failed!')
      return
    }

    // store sum and proof
    setSum(sum)
    setSumProof(proof)

    const result = Voting.tallyVotes(publicKey, privateKey, votes)
    setResult(result)

    const summary = Voting.getSummary(votes.length, result)
    setSummary(summary)
  }

  const serializeKey = (pk: string): string[] => {
    const publicKey = secp256k1.keyFromPublic(pk, 'hex').pub
    const pubX = JSON.parse(JSON.stringify(publicKey))[0]
    const pubY = JSON.parse(JSON.stringify(publicKey))[1]
    return [pubX, pubY]
  }

  return (
    <div>
      <h2>ECC Elgamal</h2>
      <div>
        Total: {summary.total} Yes: {summary.yes} No: {summary.no}
      </div>
      <br />
      <button className="btn" onClick={addYesVote}>
        Vote Yes
      </button>
      <button className="btn" onClick={addNoVote}>
        Vote No
      </button>
      <br></br>
      <h4>Public Key</h4>
      <PrettyJSON input={serializeKey(publicKey)} />
      <br></br>
      <h4>Private Key</h4>
      <PrettyJSON input={privateKey} />
      <br></br>
      {sum && sumProof && (
        <div>
          <div>
            <h4>Sum Cipher</h4>
            <PrettyJSON input={sum} />
            <h4>Sum Proof</h4>
            <PrettyJSON input={sumProof} />
            <h4>Sum Decrypted</h4>
            <PrettyJSON input={Encryption.decrypt(sum, sk)} />
          </div>
        </div>
      )}
      <hr></hr>
      {votes.map((vote, i) => (
        <div key={i}>
          <div style={{ border: '1px solid white', padding: '1em' }}>
            <strong>Vote {i}</strong>
            <h4>Vote Cipher</h4>
            <div>
              <PrettyJSON input={vote} />
            </div>
            <h4>Decrypted Point</h4>
            <div>
              <PrettyJSON input={Encryption.decrypt(vote, privateKey)} />
            </div>
            <div>
              <h4>ETH Address</h4>
              <PrettyJSON input={voterAddresses[i]} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default EccElGamalComponent

interface Props {
  input: any
}

const PrettyJSON: React.FC<Props> = ({ input }) => {
  return <pre>{JSON.stringify(input, null, 2)}</pre>
}
