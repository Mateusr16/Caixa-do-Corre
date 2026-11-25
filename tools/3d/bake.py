import numpy as np,sys,heapq,json,struct
sys.path.insert(0,'.')
from rast import raster
from PIL import Image
P=np.load('P.npy');F=np.load('F2.npy')
# remove vértices órfãos (do disco) e reindexa
used=np.unique(F);remap=-np.ones(len(P),int);remap[used]=np.arange(len(used));P=P[used];F=remap[F]
deg,xdeg,s,tx,ty=np.load('fit.npy')
def roty(a):c,s_=np.cos(a),np.sin(a);return np.array([[c,0,s_],[0,1,0],[-s_,0,c]])
R=roty(np.radians(deg))
Vr=P@R.T
img=Image.open('modelo_navy.png').convert('RGB');IW,IH=img.size;A=np.asarray(img).astype(float)
G=600
fid,_=raster(Vr,F,G,G,lambda V:np.c_[(V[:,0]+1)/2*G,(1-V[:,1])/2*G])
visF=np.zeros(len(F),bool);visF[np.unique(fid[fid>=0])]=True
# normais suaves
fn=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]])
N=np.zeros_like(P)
for k in range(3):np.add.at(N,F[:,k],fn)
N/=np.linalg.norm(N,axis=1,keepdims=True)+1e-12
nz=(N@R.T)[:,2]
visV=np.zeros(len(P),bool)
for k in range(3):visV[F[visF,k]]=True
px=np.c_[(Vr[:,0]+1)/2*G*s+tx,(1-Vr[:,1])/2*G*s+ty]
uv=px/np.array([IW,IH])
from scipy.ndimage import distance_transform_edt
fgm=np.asarray(Image.open('fgmask.png'))>0
dist=distance_transform_edt(fgm)
def at(arr,x,y):return arr[np.clip(y.astype(int),0,IH-1),np.clip(x.astype(int),0,IW-1)]
dv=at(dist,px[:,0],px[:,1])
w=visV*np.clip((nz-0.12)/0.3,0,1)*np.clip((dv-0.5)/2.5,0,1)
# cor base: mediana de um bloco 9x9 (some com as linhas de contorno)
def med(x,y,r=5):
    x=int(np.clip(x,r,IW-r-1));y=int(np.clip(y,r,IH-r-1))
    blk=A[y-r:y+r+1,x-r:x+r+1].reshape(-1,3);ok=fgm[y-r:y+r+1,x-r:x+r+1].reshape(-1)
    return np.median(blk[ok] if ok.sum()>5 else blk,0)
col=np.zeros((len(P),3));src=visV&(nz>0.4)&(dv>3.5)
for i in np.nonzero(src)[0]:col[i]=med(*px[i])
# propaga pela superfície (Dijkstra) para costas/laterais
E={}
for a,b,c in F:
    for u,v in ((a,b),(b,c),(c,a)):E.setdefault(u,set()).add(v);E.setdefault(v,set()).add(u)
dist=np.full(len(P),np.inf);lab=-np.ones(len(P),int);h=[]
for i in np.nonzero(src)[0]:dist[i]=0;lab[i]=i;h.append((0.0,i))
heapq.heapify(h)
while h:
    d,u=heapq.heappop(h)
    if d>dist[u]:continue
    for v in E.get(u,()):
        nd=d+np.linalg.norm(P[u]-P[v])
        if nd<dist[v]:dist[v]=nd;lab[v]=lab[u];heapq.heappush(h,(nd,v))
hid=~src
nb=[np.fromiter(E.get(i,()),int) for i in range(len(P))]
PAL={'navy':(36,54,104),'yellow':(247,201,22),'grey':(176,179,186),'black':(34,35,39),'white':(236,238,241),'orange':(228,104,40),'blue':(38,124,224),'lime':(176,226,46)}
names=list(PAL);pal=np.array([PAL[k] for k in names],float)
EXTRA=[((22,32,64),'navy'),((210,160,12),'yellow'),((120,85,10),'yellow'),((60,62,68),'black'),((255,255,255),'white')]
cand=np.r_[pal,np.array([c for c,_ in EXTRA],float)];cname=names+[n for _,n in EXTRA]
cls=np.array([names.index(cname[int(np.argmin(((cand-c)**2).sum(1)))]) for c in col])
cls[hid]=cls[lab[hid]]
# moda dos vizinhos para tirar manchas
for _ in range(5):
    c2=cls.copy()
    for i in np.nonzero(hid)[0]:
        if len(nb[i]):
            v=np.bincount(np.r_[cls[nb[i]],cls[i]],minlength=len(names));c2[i]=int(np.argmax(v))
    cls=c2
Y,Z=P[:,1],P[:,2]
# bag (atrás do corpo): amarela com as faixas refletivas na mesma altura da frente
bag=(Z<-0.28)&(Y>-0.55)&(Y<0.62)
gy=Y[src&bag&(cls==names.index('grey'))]
iy=lambda yi:1-2*((yi-ty)/s)/600
bands=[(iy(292),iy(268)),(iy(462),iy(438))]
inband=np.zeros(len(P),bool)
for lo,hi in bands:inband|=(Y>=lo)&(Y<hi)
m=hid&bag&((Z<-0.33)|~np.isin(cls,[names.index('black')]));cls[m]=names.index('yellow')
# capacete (alto, fora do capuz): branco, mantém só os grafismos coloridos
helm=(Y>0.6)&hid&~np.isin(cls,[names.index('navy'),names.index('orange'),names.index('blue'),names.index('lime')])
cls[helm]=names.index('white')
hu=np.array([0.6967,0.3371,0.6404]);hl=np.array([-0.189,-0.1518,0.6148])
farHands=(np.linalg.norm(P-hu,axis=1)>0.22)&(np.linalg.norm(P-hl,axis=1)>0.2)
tors=hid&(Y>-0.12)&(Y<0.6)&~bag&farHands&np.isin(cls,[names.index('black'),names.index('white'),names.index('grey'),names.index('blue')])
cls[tors]=names.index('navy')
col[hid]=pal[cls[hid]]
print('bands',[(round(a,2),round(b,2)) for a,b in bands])
np.savez('baked.npz',P=P,F=F,N=N,uv=uv,w=w,col=col,R=R)
print('verts',len(P),'faces',len(F),'textured',(w>0.5).sum())
