export type Sport = 'football'|'basketball'|'tennis'|'cricket';
export interface WeatherData {city:string;country:string;temperature:number;feelsLike:number;humidity:number;wind:number;description:string;condition:number;observedAt:number}
export interface Match {id:string;home:string;away:string;score:string;status:string;league:string;date:string;time:string}
export interface SportsData {sport:Sport;matches:Match[]}
export interface InsightResponse<T> {data:T;fetchedAt:number;expiresAt:number;cached:boolean}
