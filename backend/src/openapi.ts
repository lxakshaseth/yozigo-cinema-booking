// OpenAPI 3.0 contract, served at /api/openapi.json and /api/docs.
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ 'application/json': { schema } });
const uuid = { type: 'string', format: 'uuid' };
const idParam = { name: 'id', in: 'path', required: true, schema: uuid };
const pagination = [{name:'page',in:'query',schema:{type:'integer',minimum:1,default:1}},{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100,default:20}}];
const error = { description: 'Structured API error', content: json(ref('Error')) };
const paths: Record<string, Record<string, unknown>> = {};
function route(method: string, path: string, summary: string, options: { body?: string; auth?: boolean; response?: object; status?: string; pages?: boolean } = {}) {
  const parameters: object[] = path.includes('{id}') ? [idParam] : [];
  if (options.pages) parameters.push(...pagination);
  if (!['get','head'].includes(method)) parameters.push({name:'X-CSRF-Token',in:'header',required:true,schema:{type:'string'},description:'Fetch from GET /auth/csrf; login rotates this token.'});
  (paths[path] ??= {})[method] = { summary, tags:[path.split('/')[1]], parameters,
    ...(options.auth ? {security:[{sessionCookie:[]}]} : {}),
    ...(options.body ? {requestBody:{required:true,content:json(ref(options.body))}} : {}),
    responses:{[options.status ?? '200']:{description: options.status === '204' ? 'No content' : 'Success', ...(options.status === '204' ? {} : {content:json(options.response ?? {type:'object'})})},'400':error,'401':error,'403':error,'404':error,'409':error,'429':error}
  };
}
route('get','/health','Database-backed health check');
route('get','/auth/csrf','Create a session and obtain CSRF token');
route('post','/auth/register','Register a CUSTOMER; sign in separately',{body:'Registration',status:'201',response:ref('User')});
route('post','/auth/login','Sign in; returns user and new CSRF token',{body:'Credentials'});
route('post','/auth/logout','Destroy the current session',{auth:true,status:'204'});
route('get','/auth/me','Current public user',{auth:true,response:ref('User')});
route('get','/movies','Paginated movies; optional search, language and rating query filters',{pages:true});
route('get','/movies/{id}','Movie details',{response:ref('Movie')});
route('get','/movies/{id}/shows','Future shows ordered by start; ISO timestamps, group dates in Asia/Kolkata',{pages:true});
route('get','/shows/{id}','Show details including remainingSeats and totalSeats=80',{response:ref('Show')});
route('get','/shows/{id}/seats','80 seats: AVAILABLE, HELD_BY_ME, HELD_BY_OTHER or BOOKED; holder identity is private',{response:{type:'object',properties:{seats:{type:'array',items:ref('Seat')}}}});
route('post','/shows/{id}/holds','Atomically hold 1–6 distinct inventory UUIDs for five minutes; exact-set retry reuses hold',{auth:true,body:'HoldRequest',status:'201',response:ref('Hold')});
route('get','/holds/{id}','Own hold with historical seat coordinates',{auth:true,response:ref('Hold')});
route('delete','/holds/{id}','Release own hold; repeat requests are safe',{auth:true,response:ref('Hold')});
route('post','/holds/{id}/payment','Simulation only: SUCCESS creates one booking; FAILURE keeps hold. Success retries return original booking',{auth:true,body:'Payment'});
route('get','/bookings/me','Own bookings: upcoming ascending, then past descending',{auth:true,pages:true});
route('get','/bookings/{id}','Own booking; inaccessible IDs return 404',{auth:true,response:ref('Booking')});
route('post','/bookings/{id}/cancel','Cancel at least two hours before show; idempotent, preserves history',{auth:true,response:ref('Booking')});
for (const resource of ['movies','shows']) {
  const schema = resource === 'movies' ? 'MovieInput' : 'ShowInput';
  route('get',`/admin/${resource}`,'ADMIN only: paginated list',{auth:true,pages:true});
  route('post',`/admin/${resource}`,'ADMIN only: create',{auth:true,body:schema,status:'201'});
  route('patch',`/admin/${resource}/{id}`,'ADMIN only: update; show history/active holds prevent changes',{auth:true,body:`${schema}Patch`});
  route('delete',`/admin/${resource}/{id}`,'ADMIN only: delete unreferenced record; history prevents deletion',{auth:true,status:'204'});
}
route('get','/admin/shows/{id}/summary','ADMIN: confirmed seat occupancy and revenue; excludes cancelled bookings and all holds/failed payments',{auth:true});
route('get','/admin/shows/{id}/bookings','ADMIN: bookings including customer name, seats, timestamp and status',{auth:true,pages:true});
const movieProperties = {title:{type:'string',minLength:1,maxLength:200},posterUrl:{type:'string',format:'uri',nullable:true},language:{type:'string',minLength:1,maxLength:50},durationMinutes:{type:'integer',minimum:1,maximum:600},rating:{type:'string',enum:['U','UA','A']},description:{type:'string',nullable:true,maxLength:5000}};
const showProperties = {movieId:uuid,startsAt:{type:'string',format:'date-time'},durationMinutes:{type:'integer',minimum:1,maximum:600},ticketPricePaise:{type:'integer',minimum:1,maximum:10000000}};
const credentials = {email:{type:'string',format:'email'},password:{type:'string',minLength:8,maxLength:128}};
export const openapi = {openapi:'3.0.3',info:{title:'Yozigo Cinemas API',version:'1.0.0',description:'Single-screen cinema. Money is integer INR paise. Cookie sessions require credentials: include and CSRF tokens for every mutation, including login/register. All IDs are UUIDs. Fake payment only.'},servers:[{url:'/api'}],paths,components:{securitySchemes:{sessionCookie:{type:'apiKey',in:'cookie',name:'yozigo.sid'}},schemas:{
  Error:{type:'object',properties:{error:{type:'object',required:['code','message'],properties:{code:{type:'string'},message:{type:'string'},details:{type:'object',additionalProperties:true}}}}},
  Credentials:{type:'object',additionalProperties:false,required:['email','password'],properties:credentials},
  Registration:{type:'object',additionalProperties:false,required:['name','email','password'],properties:{...credentials,name:{type:'string',minLength:1,maxLength:100}}},
  User:{type:'object',properties:{id:uuid,name:{type:'string'},email:{type:'string'},role:{type:'string',enum:['CUSTOMER','ADMIN']}}},
  MovieInput:{type:'object',additionalProperties:false,required:['title','language','durationMinutes','rating'],properties:movieProperties},
  MovieInputPatch:{type:'object',additionalProperties:false,properties:movieProperties},
  Movie:{type:'object',properties:{id:uuid,...movieProperties}},
  ShowInput:{type:'object',additionalProperties:false,required:['movieId','startsAt','ticketPricePaise'],properties:showProperties},
  ShowInputPatch:{type:'object',additionalProperties:false,properties:showProperties},
  Show:{type:'object',properties:{id:uuid,...showProperties,endsAt:{type:'string',format:'date-time'},movie:ref('Movie'),remainingSeats:{type:'integer'},totalSeats:{type:'integer',enum:[80]}}},
  Seat:{type:'object',properties:{id:uuid,rowLabel:{type:'string',enum:[...'ABCDEFGH']},seatNumber:{type:'integer',minimum:1,maximum:10},status:{type:'string',enum:['AVAILABLE','HELD_BY_ME','HELD_BY_OTHER','BOOKED']}}},
  HoldRequest:{type:'object',additionalProperties:false,required:['seatIds'],properties:{seatIds:{type:'array',minItems:1,maxItems:6,uniqueItems:true,items:uuid}}},
  Hold:{type:'object',properties:{id:uuid,showId:uuid,expiresAt:{type:'string',format:'date-time'},status:{type:'string',enum:['ACTIVE','EXPIRED','CONFIRMED','RELEASED']},items:{type:'array',items:{type:'object',properties:{showSeatId:uuid,showSeat:ref('Seat')}}}}},
  Payment:{type:'object',additionalProperties:false,required:['outcome'],properties:{outcome:{type:'string',enum:['SUCCESS','FAILURE']}}},
  Booking:{type:'object',properties:{id:uuid,holdId:uuid,totalAmountPaise:{type:'integer'},status:{type:'string',enum:['CONFIRMED','CANCELLED']},createdAt:{type:'string',format:'date-time'},show:ref('Show'),seats:{type:'array',items:{type:'object',properties:{showSeatId:uuid,seatPricePaise:{type:'integer'},showSeat:ref('Seat')}}}}}
}}};
