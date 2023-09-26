import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { google } from 'googleapis'

dotenv.config()

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_AUTH,
})

const app = express()

app
    .use(cors())
    .use(express.json())
    .get('/health', (req, res) => {
        return res.send('OK')
    })
    .get('/youtube', async (req, res) => {
        const result = await youtube.channels.list({
            part: ["snippet,contentDetails,statistics"],
            forUsername: 'JovemNerd'
        })
        
        if(!result.data.items){
            return res.send({})
        }

        const {
            statistics,
            id,
            snippet
        } = result.data.items[0]

        if(!id){
            return res.send({
                message: 'channel'
            })
        }

        const playlistResult = await youtube.playlists.list({
            part: ['snippet,contentDetails'],
            channelId: id,
            maxResults: 40
        })
        
        if(!playlistResult.data.items){
            return res.send({
                message: 'Channel without playlists'
            })
        }

        const allPlaylists = playlistResult.data.items?.reduce((prev, curr) => {
            if(curr.id){
                prev.push(curr.id)
            }

            return prev
        }, [] as string[])
        
        const videos = await Promise.all(allPlaylists.map(async (playlist) => {
            const items = await youtube.playlistItems.list({
                part: ['snippet,contentDetails'],
                playlistId: playlist,
                maxResults: 200
            })
            if(items.data.items){
                const videosIds = items.data.items?.reduce((prev, curr) => {
                    if(curr.contentDetails && curr.contentDetails.videoId){
                        prev.push(curr.contentDetails.videoId)
                    }
                    
                    return prev
                }, [] as string[])
                
                return videosIds
            }

            return ''
        }))
        
        const rawVideosDetails = await youtube.videos.list({
            part: ['snippet,contentDetails,statistics'],
            id: [videos.flat().splice(0, 50).toString()],
            maxResults: 4000
        })

        const videosDetails = rawVideosDetails.data.items?.map(video => ({
            id: video.id,
            name: video.snippet?.title,
            statistics: video.statistics
        }))
    
        return res.send({
            videosDetails,
            videoSize: videos.flat().length,
            videos: videos.flat().splice(0, 50)
        })
    })

app.listen(5000, () => {
    console.log('server up')
})