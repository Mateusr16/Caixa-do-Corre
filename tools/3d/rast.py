import numpy as np
def raster(V,F,W,H,map_xy):
    """ortho z-buffer: returns faceid (H,W) and depth; V in model coords, map_xy(V)->pixel xy; +z toward viewer"""
    Q=map_xy(V);Z=V[:,2]
    fid=np.full((H,W),-1,np.int32);dep=np.full((H,W),-1e9)
    for t,(a,b,c) in enumerate(F):
        x0,y0=Q[a];x1,y1=Q[b];x2,y2=Q[c]
        mnx=max(int(np.floor(min(x0,x1,x2))),0);mxx=min(int(np.ceil(max(x0,x1,x2))),W-1)
        mny=max(int(np.floor(min(y0,y1,y2))),0);mxy=min(int(np.ceil(max(y0,y1,y2))),H-1)
        if mnx>mxx or mny>mxy:continue
        den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(den)<1e-12:continue
        xs,ys=np.meshgrid(np.arange(mnx,mxx+1)+.5,np.arange(mny,mxy+1)+.5)
        l0=((y1-y2)*(xs-x2)+(x2-x1)*(ys-y2))/den;l1=((y2-y0)*(xs-x2)+(x0-x2)*(ys-y2))/den;l2=1-l0-l1
        m=(l0>=-1e-6)&(l1>=-1e-6)&(l2>=-1e-6)
        if not m.any():continue
        z=l0*Z[a]+l1*Z[b]+l2*Z[c]
        sub=dep[mny:mxy+1,mnx:mxx+1];fs=fid[mny:mxy+1,mnx:mxx+1]
        u=m&(z>sub);sub[u]=z[u];fs[u]=t
    return fid,dep
