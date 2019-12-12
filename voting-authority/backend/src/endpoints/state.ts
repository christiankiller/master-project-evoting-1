import express from 'express'

import { parityConfig } from '../config'
import { AUTHORITIES_TABLE, BALLOT_DEPLOYED_TABLE, getValueFromDB, setValue, STATE_TABLE } from '../database/database'
import { BallotManager } from '../utils/ballotManager'
import { getNumberOfConnectedAuthorities } from '../utils/web3'

export enum VotingState {
  REGISTER = 'REGISTER',
  STARTUP = 'STARTUP',
  CONFIG = 'CONFIG',
  VOTING = 'VOTING',
  TALLY = 'TALLY',
}

const router: express.Router = express.Router()

router.get('/state', async (req, res) => {
  const currentState: string = <string>getValueFromDB(STATE_TABLE)
  const requiredAuthorities: number = parityConfig.numberOfAuthorityNodes

  // report current state along with information about ...
  switch (currentState) {
    // ... how many sealers are required and already registered
    case VotingState.REGISTER:
      const registeredAuthorities: string[] = <string[]>getValueFromDB(AUTHORITIES_TABLE)
      res.status(200).json({
        state: currentState,
        registeredSealers: registeredAuthorities.length,
        requiredSealers: requiredAuthorities,
      })
      break

    // ... how many sealers are required and already connected
    case VotingState.STARTUP:
      let connectedAuthorities: number = 0
      try {
        connectedAuthorities = await getNumberOfConnectedAuthorities()
      } catch (error) {
        res.status(500).json({ msg: error.message })
        return
      }
      res.status(200).json({
        state: currentState,
        connectedSealers: connectedAuthorities,
        requiredSealers: requiredAuthorities,
      })
      break

    // ... how many public key shares are required and already submitted
    case VotingState.CONFIG:
      let submittedKeyShares: number = 0
      try {
        submittedKeyShares = await BallotManager.getNrOfPublicKeyShares()
      } catch (error) {
        res.status(500).json({ msg: error.message })
        return
      }

      const requiredKeyShares: number = requiredAuthorities
      res.status(200).json({
        state: currentState,
        submittedKeyShares: submittedKeyShares,
        requiredKeyShares: requiredKeyShares,
      })
      break

    default:
      res.status(200).json({ state: currentState })
  }
})

router.post('/state', async (req, res) => {
  const currentState: string = <string>getValueFromDB(STATE_TABLE)
  const requiredAuthorities: number = parityConfig.numberOfAuthorityNodes

  let isBallotOpen = false

  switch (currentState) {
    case VotingState.REGISTER:
      // verify that all sealers are registered
      const registeredAuthorities: string[] = <string[]>getValueFromDB(AUTHORITIES_TABLE)
      if (registeredAuthorities.length !== requiredAuthorities) {
        res.status(400).json({
          state: currentState,
          msg: `There are only ${registeredAuthorities.length} sealers registered. ${requiredAuthorities} are needed for the next stage.`,
        })
        return
      }

      setValue(STATE_TABLE, VotingState.STARTUP)
      break
    case VotingState.STARTUP:
      // verify that all sealers are connected
      let connectedAuthorities: number = 0
      try {
        connectedAuthorities = await getNumberOfConnectedAuthorities()
      } catch (error) {
        res.status(500).json({ msg: error.message })
        return
      }

      if (connectedAuthorities !== requiredAuthorities) {
        res.status(400).json({
          state: currentState,
          msg: `There are only ${connectedAuthorities} sealers connected. ${requiredAuthorities} are needed for the next stage.`,
        })
        return
      }

      // verify that the contracts are deployed
      const isDeployed: boolean = <boolean>getValueFromDB(BALLOT_DEPLOYED_TABLE)
      if (!isDeployed) {
        res.status(400).json({
          msg: `The ballot contract is not deployed yet. Please create a voting question and deploy all contracts!`,
        })
        return
      }

      setValue(STATE_TABLE, VotingState.CONFIG)
      break
    case VotingState.CONFIG:
      // TODO: check that all public key shares are submitted
      // TODO: check that the public key is generated
      try {
        await BallotManager.openBallot()
        isBallotOpen = await BallotManager.isBallotOpen()
      } catch (error) {
        res.status(500).json({ msg: error.message })
        return
      }

      setValue(STATE_TABLE, VotingState.VOTING)
      break
    case VotingState.VOTING:
      try {
        await BallotManager.closeBallot()
        isBallotOpen = await BallotManager.isBallotOpen()
      } catch (error) {
        res.status(500).json({ msg: error.message })
        return
      }

      setValue(STATE_TABLE, VotingState.TALLY)
      break

    default:
      res.status(400).json({ state: currentState, msg: `There is nothing to change!` })
      return
  }

  const newState: string = getValueFromDB(STATE_TABLE)
  res.status(201).json({ state: newState, msg: `Changed from '${currentState}' to '${newState}'`, isBallotOpen: `${isBallotOpen}` })
})

export default router